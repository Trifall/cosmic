export const isActiveRoute = (pathname: string, href: string): boolean => {
	// handle empty paths
	if (!pathname || !href) {
		return false;
	}

	// handle root path exactly
	if (href === '/') {
		return pathname === '/';
	}

	// remove trailing slashes for comparison
	const normHref = href.replace(/\/$/, '');
	const normPath = pathname.replace(/\/$/, '');

	// exact match case - always return true
	if (normPath === normHref) {
		return true;
	}

	// check if current path is a child of the href
	if (normPath.startsWith(normHref + '/')) {
		return false;
	}

	return false;
};
