module.exports = {
  apps: [
    {
      name: 'v2-server',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: ['apps/server/src/index.ts'],
      interpreter: 'node',
      cwd: __dirname,
      env: { PORT: '7870', HOST: '127.0.0.1' },
      out_file: 'data/logs/v2-server.out.log',
      error_file: 'data/logs/v2-server.err.log',
      time: true,
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 5000
    },
    {
      name: 'v2-worker',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: ['apps/server/src/worker.ts'],
      interpreter: 'node',
      cwd: __dirname,
      out_file: 'data/logs/v2-worker.out.log',
      error_file: 'data/logs/v2-worker.err.log',
      time: true,
      autorestart: true,
      max_memory_restart: '1G',
      kill_timeout: 5000
    }
  ]
}