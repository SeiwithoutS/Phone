import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

function npm(args, stdio = 'inherit') {
  return process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'npm.cmd', ...args], { stdio })
    : spawnSync('npm', args, { stdio })
}

function runNpm(args, help) {
  const result = npm(args)
  if (result.status === 0) return
  if (result.error) console.error(result.error.message)
  console.error(help)
  process.exit(1)
}

if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('EPhone needs Node.js 22 or later.')
  process.exit(1)
}

const args = process.argv.slice(2)
if (args.some(arg => arg !== '--install' && arg !== '--build')) {
  console.error('Options: --build to rebuild, --install to reinstall dependencies and rebuild.')
  process.exit(1)
}

async function prepare(forceInstall) {
  let ready = !forceInstall && npm(['ls', '--all', '--include=dev'], 'ignore').status === 0
  if (ready) {
    try {
      await import('@tailwindcss/vite')
    } catch {
      ready = false
    }
  }

  if (!ready) {
    console.log('Installing EPhone dependencies from package-lock.json...')
    runNpm(['ci', '--include=dev', '--include=optional', '--prefer-offline', '--no-audit', '--no-fund'],
      'If npm reports EPERM or EBUSY, close other EPhone/Vite terminals and retry. A first install needs access to the npm registry or a complete cache.')
  }

  runNpm(['run', 'build'], 'If the build reports a missing dependency or native module, close other EPhone/Vite terminals and run npm start -- --install.')
}

const forceInstall = args.includes('--install')
const server = new URL('../build/server/index.js', import.meta.url)
const page = new URL('../dist/index.html', import.meta.url)
if (forceInstall || args.includes('--build') || !existsSync(server) || !existsSync(page)) {
  await prepare(forceInstall)
}
await import(server.href)
