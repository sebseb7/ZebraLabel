package com.zebralabel

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.nio.charset.StandardCharsets
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class ZebraPrinterModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val ACTION_USB_PERMISSION = "com.zebralabel.USB_PERMISSION"
    private const val PERMISSION_TIMEOUT_MS = 30000L
    private const val USB_WRITE_TIMEOUT_MS = 10000
    private const val ZEBRA_VENDOR_ID = 0x0A5F
  }

  private val usbManager: UsbManager by lazy {
    reactContext.getSystemService(Context.USB_SERVICE) as UsbManager
  }

  @Volatile
  private var pendingPermissionDevice: UsbDevice? = null

  @Volatile
  private var permissionGranted: Boolean = false

  @Volatile
  private var permissionLatch: CountDownLatch? = null

  private val permissionReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action != ACTION_USB_PERMISSION) {
        return
      }

      val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
      }

      if (device != null && device == pendingPermissionDevice) {
        permissionGranted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
        permissionLatch?.countDown()
      }
    }
  }

  init {
    val filter = IntentFilter(ACTION_USB_PERMISSION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactContext.registerReceiver(permissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      reactContext.registerReceiver(permissionReceiver, filter)
    }
  }

  override fun getName(): String = "ZebraPrinter"

  override fun invalidate() {
    try {
      reactContext.unregisterReceiver(permissionReceiver)
    } catch (_: IllegalArgumentException) {
      // Already unregistered.
    }
    super.invalidate()
  }

  @ReactMethod
  fun getUsbPrinters(promise: Promise) {
    Thread {
      try {
        val result = Arguments.createArray()

        discoverZebraDevices().forEach { device ->
          val map = Arguments.createMap()
          map.putString("name", device.deviceName)
          map.putInt("vendorId", device.vendorId)
          map.putInt("productId", device.productId)
          map.putBoolean("hasPermission", usbManager.hasPermission(device))
          putNullableString(map, "manufacturerName", safeString { device.manufacturerName })
          putNullableString(map, "productName", safeString { device.productName })
          putNullableString(map, "serialNumber", safeString { device.serialNumber })
          result.pushMap(map)
        }

        promise.resolve(result)
      } catch (error: Exception) {
        promise.reject("USB_DISCOVERY_FAILED", error.message, error)
      }
    }.start()
  }

  @ReactMethod
  fun printZpl(zpl: String, promise: Promise) {
    Thread {
      var connection: UsbDeviceConnection? = null
      var claimedInterface: UsbInterface? = null

      try {
        val device = discoverZebraDevices().firstOrNull()
          ?: throw IllegalStateException("No USB Zebra printer found. Connect the ZD410 by USB and try again.")

        ensurePermission(device)

        val target = findWritableInterface(device)
          ?: throw IllegalStateException("No writable USB bulk endpoint found on the Zebra printer.")

        connection = usbManager.openDevice(device)
          ?: throw IllegalStateException("Could not open USB connection to the Zebra printer.")

        if (!connection.claimInterface(target.usbInterface, true)) {
          throw IllegalStateException("Could not claim the Zebra printer USB interface.")
        }
        claimedInterface = target.usbInterface

        val bytes = zpl.toByteArray(StandardCharsets.UTF_8)
        var offset = 0
        while (offset < bytes.size) {
          val chunkLength = minOf(target.endpoint.maxPacketSize.coerceAtLeast(64), bytes.size - offset)
          val chunk = bytes.copyOfRange(offset, offset + chunkLength)
          val written = connection.bulkTransfer(target.endpoint, chunk, chunk.size, USB_WRITE_TIMEOUT_MS)
          if (written < 0) {
            throw IllegalStateException("USB write to Zebra printer failed.")
          }
          offset += written
        }

        promise.resolve("Label sent to printer")
      } catch (error: Exception) {
        promise.reject("PRINT_FAILED", error.message, error)
      } finally {
        if (connection != null && claimedInterface != null) {
          connection.releaseInterface(claimedInterface)
        }
        connection?.close()
      }
    }.start()
  }

  private fun discoverZebraDevices(): List<UsbDevice> =
    usbManager.deviceList.values.filter { isLikelyZebraPrinter(it) }

  private fun isLikelyZebraPrinter(device: UsbDevice): Boolean {
    if (device.vendorId == ZEBRA_VENDOR_ID) {
      return true
    }

    val manufacturer = safeString { device.manufacturerName }?.lowercase(Locale.US).orEmpty()
    val product = safeString { device.productName }?.lowercase(Locale.US).orEmpty()
    if (manufacturer.contains("zebra") || product.contains("zebra") || product.contains("zd410")) {
      return true
    }

    for (interfaceIndex in 0 until device.interfaceCount) {
      val usbInterface = device.getInterface(interfaceIndex)
      if (usbInterface.interfaceClass == UsbConstants.USB_CLASS_PRINTER) {
        return true
      }
    }

    return false
  }

  private fun findWritableInterface(device: UsbDevice): WritableUsbTarget? {
    for (interfaceIndex in 0 until device.interfaceCount) {
      val usbInterface = device.getInterface(interfaceIndex)
      for (endpointIndex in 0 until usbInterface.endpointCount) {
        val endpoint = usbInterface.getEndpoint(endpointIndex)
        if (endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
          endpoint.direction == UsbConstants.USB_DIR_OUT
        ) {
          return WritableUsbTarget(usbInterface, endpoint)
        }
      }
    }

    return null
  }

  private fun ensurePermission(device: UsbDevice) {
    if (usbManager.hasPermission(device)) {
      return
    }

    val latch = CountDownLatch(1)
    permissionGranted = false
    pendingPermissionDevice = device
    permissionLatch = latch

    val intent = Intent(ACTION_USB_PERMISSION).setPackage(reactContext.packageName)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
    val permissionIntent = PendingIntent.getBroadcast(reactContext, 0, intent, flags)

    usbManager.requestPermission(device, permissionIntent)

    val completed = latch.await(PERMISSION_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    permissionLatch = null
    pendingPermissionDevice = null

    if (!completed) {
      throw SecurityException("Timed out waiting for USB permission.")
    }

    if (!permissionGranted || !usbManager.hasPermission(device)) {
      throw SecurityException("USB permission denied for Zebra printer.")
    }
  }

  private fun putNullableString(map: WritableMap, key: String, value: String?) {
    if (value == null) {
      map.putNull(key)
    } else {
      map.putString(key, value)
    }
  }

  private fun safeString(block: () -> String?): String? =
    try {
      block()
    } catch (_: SecurityException) {
      null
    }

  private data class WritableUsbTarget(
    val usbInterface: UsbInterface,
    val endpoint: UsbEndpoint,
  )
}
