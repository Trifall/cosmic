<script lang="ts">
	import type { DBUser } from '$database/schema';
	import { Eye, SquarePen, Trash2Icon } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { ROUTES } from '$src/lib/routes';

	let { user, onDelete }: { user: DBUser; onDelete: (user: DBUser) => void } = $props();
</script>

<div class="flex gap-1">
	<a
		href={resolve(ROUTES.ADMIN.USERS.VIEW.replace('{userId}', user.id) as Pathname)}
		class="group flex items-center justify-center rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
		title="View user profile"
	>
		<Eye size={16} class="group-hover:stroke-blue-400" />
	</a>
	<a
		href={resolve(ROUTES.ADMIN.USERS.EDIT.replace('{userId}', user.id) as Pathname)}
		class="group flex items-center justify-center rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
		title="Edit user"
	>
		<SquarePen size={16} class="group-hover:stroke-green-400" />
	</a>
	<button
		onclick={() => onDelete(user)}
		class="group flex items-center justify-center rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
		title="Delete user"
	>
		<Trash2Icon size={16} class="group-hover:stroke-red-400" />
	</button>
</div>
