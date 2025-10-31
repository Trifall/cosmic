<script lang="ts">
	import type { DBUser } from '$database/schema';
	import type { ColumnDef } from '@tanstack/table-core';
	import { createRawSnippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import DataTable from '$lib/components/table/table.svelte';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle,
	} from '$lib/components/ui/alert-dialog';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { renderComponent, renderSnippet } from '$lib/components/ui/data-table/index.js';
	import { ROUTES } from '$src/lib/routes';
	import { formatUserName, getPublicSiteName } from '$src/lib/utils/format';
	import { Button } from '$components/ui/button';
	import type { PageProps } from './$types';
	import { deleteUser as deleteUserCommand } from './admin-users.remote';
	import DataTableActions from './data-table-actions.svelte';

	let { data }: { data: PageProps['data'] } = $props();
	let allUsers = $derived<DBUser[]>(data.users || []);
	let pagination = $derived(data.pagination);
	let searchTerm = $derived(data.search || '');
	let bannedOnly = $derived(data.bannedOnly || false);
	let isLoading = $state(false);

	let tableRef: DataTable<DBUser, any>;

	// table column configuration using TanStack Table ColumnDef
	const columns: ColumnDef<DBUser>[] = [
		{
			id: 'actions',
			header: 'Actions',
			cell: ({ row }) =>
				renderComponent(DataTableActions, {
					user: row.original,
					onDelete: confirmDelete,
				}),
			enableSorting: false,
			meta: {
				headerClass: 'w-32',
				cellClass: 'w-32',
			},
		},
		{
			accessorKey: 'username',
			header: 'Username',
			cell: ({ row }) => {
				const user = row.original;
				const usernameSnippet = createRawSnippet<[DBUser]>((getUser) => {
					const u = getUser();
					const bannedIcon = u.banned
						? `<div title="Ban Reason: ${u.banReason || 'No reason provided'}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/></svg></div>`
						: '';
					return {
						render: () => `
							<div class="flex items-center gap-2">
								<span class="truncate font-medium" title="${formatUserName(u)}">${formatUserName(u)}</span>
								${bannedIcon}
							</div>
						`,
					};
				});
				return renderSnippet(usernameSnippet, user);
			},
			meta: {
				headerClass: 'w-96',
				cellClass: 'w-96',
			},
		},
		{
			accessorKey: 'email',
			header: 'Email',
			cell: ({ row }) => {
				const user = row.original;
				const emailSnippet = createRawSnippet<[string]>((getEmail) => {
					const email = getEmail();
					return {
						render: () => `<span class="block truncate" title="${email}">${email}</span>`,
					};
				});
				return renderSnippet(emailSnippet, user.email);
			},
			meta: {
				headerClass: 'w-64',
				cellClass: 'w-64',
			},
		},
		{
			accessorKey: 'role',
			header: 'Role',
			cell: ({ row }) => {
				const user = row.original;
				const roleSnippet = createRawSnippet<[string | null]>((getRole) => {
					const role = getRole();
					const isAdmin = role === 'admin';
					const bgColor = isAdmin
						? 'bg-green-100 dark:bg-green-900/20'
						: 'bg-blue-100 dark:bg-blue-900/20';
					const textColor = isAdmin
						? 'text-green-800 dark:text-green-400'
						: 'text-blue-800 dark:text-blue-400';
					const label = isAdmin ? 'Admin' : 'User';
					return {
						render: () =>
							`<span class="inline-flex items-center rounded-full ${bgColor} px-2 py-0.5 text-xs font-medium ${textColor}">${label}</span>`,
					};
				});
				return renderSnippet(roleSnippet, user.role);
			},
			meta: {
				headerClass: 'w-20',
				cellClass: 'w-20',
			},
		},
		{
			accessorKey: 'banned',
			header: 'Status',
			cell: ({ row }) => {
				const user = row.original;
				const statusSnippet = createRawSnippet<[boolean | null]>((getBanned) => {
					const banned = getBanned();
					const isBanned = !!banned;
					const bgColor = isBanned
						? 'bg-red-100 dark:bg-red-900/20'
						: 'bg-green-100 dark:bg-green-900/20';
					const textColor = isBanned
						? 'text-red-800 dark:text-red-400'
						: 'text-green-800 dark:text-green-400';
					const label = isBanned ? 'Banned' : 'Active';
					return {
						render: () =>
							`<span class="inline-flex items-center rounded-full ${bgColor} px-2 py-0.5 text-xs font-medium ${textColor}" title="Ban Reason: ${user.banReason || 'No reason provided'}">${label}</span>`,
					};
				});
				return renderSnippet(statusSnippet, user.banned);
			},
			meta: {
				headerClass: 'w-24',
				cellClass: 'w-24',
			},
		},
		{
			accessorKey: 'createdAt',
			header: 'Created',
			cell: ({ row }) => {
				const user = row.original;
				const dateSnippet = createRawSnippet<[Date]>((getDate) => {
					const date = getDate();
					const formatted = new Date(date).toLocaleString();
					return {
						render: () =>
							`<div class="whitespace-nowrap text-sm text-muted-foreground" title="${formatted}">${formatted}</div>`,
					};
				});
				return renderSnippet(dateSnippet, user.createdAt);
			},
			meta: {
				headerClass: 'w-44',
				cellClass: 'w-44',
			},
		},
	];

	const handleSearch = () => {
		const url = new URL(window.location.href);
		if (searchTerm) {
			url.searchParams.set('search', searchTerm);
		} else {
			url.searchParams.delete('search');
		}
		url.searchParams.set('page', '1'); // reset to page 1 on search
		goto(resolve((url.pathname + url.search) as Pathname));
	};

	const handleBannedFilterChange = (checked: boolean) => {
		const url = new URL(window.location.href);
		if (checked) {
			url.searchParams.set('bannedOnly', 'true');
		} else {
			url.searchParams.delete('bannedOnly');
		}
		url.searchParams.set('page', '1'); // reset to page 1 on filter change
		goto(resolve((url.pathname + url.search) as Pathname));
	};

	let isDeleteDialogOpen = $state(false);
	let userToDelete = $state<DBUser | null>(null);

	const confirmDelete = (user: DBUser) => {
		userToDelete = user;
		isDeleteDialogOpen = true;
	};
</script>

<svelte:head>
	<title>Admin - Users - {getPublicSiteName()}</title>
</svelte:head>

<div class="container mx-auto px-4">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Admin - All Users</h1>
	</div>

	<!-- All Users Section -->
	<div class="w-full max-w-full">
		<!-- Controls -->
		<div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<!-- Search and Filter -->
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				<!-- Search Bar -->
				<div class="flex w-full max-w-lg gap-2 sm:w-auto">
					<input
						type="text"
						placeholder="Search users (username, email, ID)..."
						class="h-8 w-[270px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						bind:value={searchTerm}
						onkeydown={(e) => e.key === 'Enter' && handleSearch()}
					/>
					<Button onclick={handleSearch} size="sm" class="h-8">Search</Button>
					{#if data.search}
						<Button
							variant="outline"
							size="sm"
							class="h-8"
							onclick={() => {
								searchTerm = '';
								handleSearch();
							}}
						>
							Clear
						</Button>
					{/if}
				</div>

				<!-- Banned Filter -->
				<div class="flex items-center space-x-2">
					<Checkbox
						id="banned-filter"
						checked={bannedOnly}
						onCheckedChange={(checked) => handleBannedFilterChange(checked)}
					/>
					<label
						for="banned-filter"
						class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
					>
						Show banned only
					</label>
				</div>
			</div>

			<!-- Add User Button -->
			<Button href={ROUTES.ADMIN.USERS.ADD}>Add User</Button>
		</div>

		<!-- Error Display -->
		{#if data.error}
			<div class="mb-4 rounded-md bg-destructive/15 p-4 text-destructive">
				<p>{data.error}</p>
			</div>
		{/if}

		<!-- Users Table -->
		<DataTable
			bind:this={tableRef}
			{columns}
			data={allUsers}
			bind:pagination
			{isLoading}
			searchTerm={data.search}
			onOptimisticDelete={(deletedId) => {
				allUsers = allUsers.filter((user) => user.id !== deletedId);
			}}
		>
			{#snippet emptyState()}
				{#if data.search}
					No users found matching "{data.search}"
				{:else if data.bannedOnly}
					No banned users found.
				{:else}
					No users found.
				{/if}
			{/snippet}
		</DataTable>
	</div>
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog
	open={isDeleteDialogOpen}
	onOpenChange={(open: boolean) => (isDeleteDialogOpen = open)}
>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>Are you sure you want to delete this user?</AlertDialogTitle>
			<AlertDialogDescription>
				You are about to delete user "{formatUserName(userToDelete as Partial<DBUser>)}". This
				action cannot be undone.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Cancel</AlertDialogCancel>
			<AlertDialogAction
				onclick={async () => {
					if (!userToDelete?.id) return;

					const toastId = toast.loading('Deleting user...');

					try {
						// handle optimistic UI update before deletion
						if (tableRef) {
							await tableRef.handleOptimisticDeletion(userToDelete.id);
						}

						// call remote function to delete user
						await deleteUserCommand({ userId: userToDelete.id });

						isDeleteDialogOpen = false;
						toast.dismiss(toastId);
						toast.success('User deleted successfully');

						// revalidate to update pagination and counts
						await invalidateAll();
					} catch (error) {
						toast.dismiss(toastId);
						toast.error(`Failed to delete user: ${error}`);
					}
				}}
			>
				Delete
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
