export const ROUTES = {
	ADMIN: {
		BASE: '/admin',
		USERS: {
			BASE: '/admin/users',
			INDEX: '/admin/users',
			ADD: '/admin/users/add',
			EDIT: '/admin/users/{userId}/edit',
			VIEW: '/admin/users/{userId}',
		},
		ROLES: {
			BASE: '/admin/roles',
			ADD: '/admin/roles/add',
			EDIT: '/admin/roles/{roleId}/edit',
		},
		JOBS: {
			BASE: '/admin/jobs',
			DETAILS: '/admin/jobs/{jobId}',
		},
		PASTES: '/admin/pastes',
		SETTINGS: '/admin/settings',
		LIBRARY: '/admin/library',
	},
	HOME: '/',
	DASHBOARD: '/dashboard',
	PROFILE: '/profile',
	AUTH: {
		SIGNIN: '/signin',
		SIGNUP: '/signup',
	},
	SETUP: '/setup',
};

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
