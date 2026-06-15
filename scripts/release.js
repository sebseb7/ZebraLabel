const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const buildGradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');
const isWindows = process.platform === 'win32';

function runGit(args, {allowFailure = false} = {}) {
  const result = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: isWindows,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0 && !allowFailure) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    console.error(stderr || stdout || `git ${args.join(' ')} failed`);
    process.exit(result.status ?? 1);
  }

  return result;
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    console.error(`Invalid semver: ${version}`);
    process.exit(1);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function formatVersion({major, minor, patch}) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(current, bumpType) {
  const version = parseVersion(current);

  if (bumpType === 'major') {
    return formatVersion({major: version.major + 1, minor: 0, patch: 0});
  }

  if (bumpType === 'minor') {
    return formatVersion({major: version.major, minor: version.minor + 1, patch: 0});
  }

  if (bumpType === 'patch') {
    return formatVersion({
      major: version.major,
      minor: version.minor,
      patch: version.patch + 1,
    });
  }

  parseVersion(bumpType);
  return bumpType;
}

function versionCodeFor({major, minor, patch}) {
  return major * 10000 + minor * 100 + patch;
}

function ensureCleanWorkingTree() {
  const status = runGit(['status', '--porcelain']).stdout.trim();
  if (status) {
    console.error('Working tree is not clean. Commit or stash changes before releasing.');
    process.exit(1);
  }
}

function ensureTagDoesNotExist(tag) {
  const result = runGit(['rev-parse', '--verify', `refs/tags/${tag}`], {
    allowFailure: true,
  });

  if (result.status === 0) {
    console.error(`Tag ${tag} already exists.`);
    process.exit(1);
  }
}

function updatePackageJson(version) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = version;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function updateAndroidVersion(version) {
  const parsed = parseVersion(version);
  const versionCode = versionCodeFor(parsed);
  let gradle = fs.readFileSync(buildGradlePath, 'utf8');

  gradle = gradle.replace(
    /versionCode\s+\d+/,
    `versionCode ${versionCode}`,
  );
  gradle = gradle.replace(
    /versionName\s+"[^"]+"/,
    `versionName "${version}"`,
  );

  fs.writeFileSync(buildGradlePath, gradle);
}

function main() {
  const bumpType = process.argv[2] || 'patch';
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = packageJson.version;
  const nextVersion = bumpVersion(currentVersion, bumpType);
  const tag = `v${nextVersion}`;

  ensureCleanWorkingTree();
  ensureTagDoesNotExist(tag);

  console.log(`Releasing ${currentVersion} -> ${nextVersion}`);

  updatePackageJson(nextVersion);
  updateAndroidVersion(nextVersion);

  runGit(['add', 'package.json', 'android/app/build.gradle']);
  runGit(['commit', '-m', `Release ${tag}`]);
  runGit(['tag', '-a', tag, '-m', `Release ${tag}`]);

  console.log(`\nCreated commit and tag ${tag}.`);
  console.log('Push to GitHub to build and publish the release:\n');
  console.log(`  git push origin HEAD ${tag}\n`);
}

main();
