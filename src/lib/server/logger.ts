import winston from 'winston';

// create the main winston logger instance
const fileFormat = winston.format.combine(
	winston.format.timestamp(),
	winston.format.errors({ stack: true }),
	winston.format.json()
);
// build transports array based on environment
const transports: winston.transport[] = [];

// add file transports in production
if (process.env.FILE_LOGS === 'true') {
	transports.push(
		new winston.transports.File({
			filename: 'logs/error.log',
			level: 'error',
			format: fileFormat,
		}),
		new winston.transports.File({ filename: 'logs/combined.log', format: fileFormat })
	);
}

// always add console transport
transports.push(
	new winston.transports.Console({
		format: winston.format.combine(
			winston.format.colorize(),
			winston.format.timestamp({ format: 'HH:mm:ss' }),
			winston.format.printf(({ timestamp, level, message, module, ...meta }) => {
				// create a clean, readable format
				const modulePrefix = module ? `[${module}] ` : '';
				const metaStr =
					Object.keys(meta).length > 0 && meta.service !== 'cosmic'
						? ` ${JSON.stringify(meta)}`
						: '';

				return `${timestamp} ${level}: ${modulePrefix}${message}${metaStr}`;
			})
		),
	})
);

const logger = winston.createLogger({
	level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
	format: fileFormat,
	defaultMeta: { service: 'cosmic' },
	transports: transports,
});

/**
 * Creates a child logger with a specific module name
 * @param module - The module name to use as a label
 * @returns Winston logger instance with module-specific labeling
 */
export const createChildLogger = (module: string): winston.Logger => {
	return logger.child({ module });
};

export { logger };
export default logger;
