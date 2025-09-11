type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
  name?: string;
}

export function createLogger(opts: LoggerOptions = {}) {
  const levelOrder: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const minLevel = opts.level ?? 'info';
  const minIdx = levelOrder.indexOf(minLevel);
  const name = opts.name ? `[${opts.name}]` : '';

  function log(lvl: LogLevel, ...args: unknown[]) {
    if (levelOrder.indexOf(lvl) < minIdx) return;
    const ts = new Date().toISOString();
    // eslint-disable-next-line no-console
    console[lvl === 'debug' ? 'log' : lvl](`${ts} ${name} ${lvl.toUpperCase()}:`, ...args);
  }

  return {
    debug: (...a: unknown[]) => log('debug', ...a),
    info: (...a: unknown[]) => log('info', ...a),
    warn: (...a: unknown[]) => log('warn', ...a),
    error: (...a: unknown[]) => log('error', ...a),
  };
}

