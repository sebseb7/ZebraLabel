package com.zebralabel

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning

class BarcodeScannerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BarcodeScanner"

  @ReactMethod
  fun scan(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "Cannot scan without an active screen")
      return
    }

    activity.runOnUiThread {
      val options = GmsBarcodeScannerOptions.Builder()
        .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8)
        .enableAutoZoom()
        .allowManualInput()
        .build()
      val scanner: GmsBarcodeScanner = GmsBarcodeScanning.getClient(activity, options)

      scanner.startScan()
        .addOnSuccessListener { barcode ->
          val value = barcode.rawValue ?: barcode.displayValue
          if (value.isNullOrBlank()) {
            promise.reject("E_EMPTY", "Barcode had no readable value")
            return@addOnSuccessListener
          }
          promise.resolve(value)
        }
        .addOnCanceledListener {
          promise.reject("E_CANCELED", "Scan canceled")
        }
        .addOnFailureListener { error ->
          promise.reject("E_SCAN_FAILED", error.message ?: "Barcode scan failed", error)
        }
    }
  }
}
