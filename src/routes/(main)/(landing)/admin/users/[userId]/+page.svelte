<script lang="ts">
	import ProfileDisplay from '@/src/lib/components/ProfileDisplay.svelte';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { Button } from '$lib/components/ui/button';
	import { ROUTES } from '$src/lib/routes';
	import { formatUserName, getPublicSiteName } from '$src/lib/utils/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let user = $derived(data.user);
</script>

<svelte:head>
	<title>User Profile: {formatUserName(user)} - Admin - {getPublicSiteName()}</title>
</svelte:head>

<div class="container mx-auto px-4">
	<!-- Header Section -->
	<div class="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-xl font-bold md:text-2xl">Admin View - User Profile</h1>
		</div>
		<div class="flex items-center gap-2">
			<Button
				class="h-10"
				href={resolve(ROUTES.ADMIN.USERS.INDEX as Pathname)}
				variant="outline"
				size="sm">← Back to Users</Button
			>
			<Button
				class="max-w-32"
				href={resolve(ROUTES.ADMIN.USERS.EDIT.replace('{userId}', user.id) as Pathname)}
				variant="default"
			>
				Edit User
			</Button>
		</div>
	</div>

	<ProfileDisplay user={data.user} statistics={data.statistics} error={data.error} />
</div>
