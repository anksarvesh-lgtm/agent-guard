import path from 'node:path';

const BLOCKED_NAMES = [
  'credentials',
  'secrets',
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
  'id_dsa',
];

const BLOCKED_EXTENSIONS = [
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.cer',
  '.crt',
  '.kdbx',
];

const BLOCKED_DIRECTORIES = [
  'node_modules',
  'build',
  'dist',
  '.dart_tool',
  'Pods',
  '.gradle',
  'vendor',
  '.git',
  '.next',
  '.cache',
];

/**
 * Returns true if a relative or absolute file path points to a secret or disallowed build artifact.
 */
export function isSensitiveOrIgnored(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();

  // Check blocked directories
  const parts = normalized.split('/');
  if (parts.some((p) => BLOCKED_DIRECTORIES.includes(p))) {
    return true;
  }

  // Check .env files
  if (basename === '.env' || basename.startsWith('.env.')) {
    return true;
  }

  // Check secret file extensions
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return true;
  }

  // Check blocked exact names
  if (BLOCKED_NAMES.includes(basename)) {
    return true;
  }

  return false;
}
