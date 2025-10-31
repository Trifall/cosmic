/**
 * System-related utility functions for the admin dashboard
 */

/**
 * Gets the server uptime in a formatted string and milliseconds
 * @returns Object containing formatted uptime string and raw milliseconds
 */
export const getServerUptime = (): { formatted: string; milliseconds: number } => {
	// get the process uptime in seconds
	const uptimeSeconds = process.uptime();
	const uptimeMs = uptimeSeconds * 1000;

	// calculate days, hours, minutes, seconds
	const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
	const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
	const minutes = Math.floor((uptimeSeconds % (60 * 60)) / 60);
	const seconds = Math.floor(uptimeSeconds % 60);

	// format the uptime string
	let formatted = '';
	if (days > 0) {
		formatted += `${days}d `;
	}
	if (hours > 0 || days > 0) {
		formatted += `${hours}h `;
	}
	if (minutes > 0 || hours > 0 || days > 0) {
		formatted += `${minutes}m `;
	}
	formatted += `${seconds}s`;

	return {
		formatted,
		milliseconds: uptimeMs,
	};
};
