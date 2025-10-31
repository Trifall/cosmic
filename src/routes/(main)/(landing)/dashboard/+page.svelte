<script lang="ts">
	import { LANGUAGE_MAP, type SupportedLanguage } from '@/src/lib/shared/languages';
	import type { ColumnDef } from '@tanstack/table-core';
	import { createRawSnippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
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
	import { renderComponent, renderSnippet } from '$lib/components/ui/data-table/index.js';
	import { ROUTES } from '$src/lib/routes';
	import type { SinglePasteData } from '$src/lib/shared/pastes';
	import { capitalizeFirstLetter, getPublicSiteName } from '$src/lib/utils/format';
	import { Button } from '$components/ui/button';
	import type { PageProps } from './$types';
	import DataTableActions from './data-table-actions.svelte';

	let { data }: PageProps = $props();

	let userPastes: SinglePasteData[] = $derived(data.pastes || []);
	let pagination = $derived(data.pagination);
	let searchTerm = $derived(data.search || '');
	let isLoading = $state(false);

	let tableRef: DataTable<SinglePasteData, any>;

	let isDeleteDialogOpen = $state(false);
	let pasteToDelete = $state<(typeof userPastes)[0] | null>(null);

	// table column configuration using TanStack Table ColumnDef
	const columns: ColumnDef<SinglePasteData>[] = [
		{
			id: 'actions',
			header: 'Actions',
			cell: ({ row }) =>
				renderComponent(DataTableActions, {
					paste: row.original,
					onDelete: confirmDelete,
				}),
			enableSorting: false,
			meta: {
				headerClass: 'w-32',
				cellClass: 'w-32',
			},
		},
		{
			accessorKey: 'title',
			header: 'Title',
			cell: ({ row }) => {
				const paste = row.original;
				const titleSnippet = createRawSnippet<[SinglePasteData]>((getPaste) => {
					const p = getPaste();
					const displayTitle = p.title || `Paste ${p.id}`;
					const customSlugPrefix = p.customSlug
						? `<span class="mr-1 text-xs text-muted-foreground">(/${p.customSlug})</span>`
						: '';
					return {
						render: () => `
							<div class="max-w-md truncate pr-2" title="${displayTitle}">
								${customSlugPrefix}
								<span class="font-medium">${displayTitle}</span>
							</div>
						`,
					};
				});
				return renderSnippet(titleSnippet, paste);
			},
			meta: {
				headerClass: 'w-auto',
				cellClass: 'max-w-md',
			},
		},
		{
			accessorKey: 'language',
			header: 'Language',
			cell: ({ row }) => {
				const paste = row.original;
				const langSnippet = createRawSnippet<[SinglePasteData]>((getPaste) => {
					const p = getPaste();
					const displayLang = p.language
						? LANGUAGE_MAP[p.language as SupportedLanguage]
						: 'plaintext';
					return {
						render: () =>
							`<div class="truncate capitalize" title="${displayLang}">${displayLang}</div>`,
					};
				});
				return renderSnippet(langSnippet, paste);
			},
			meta: {
				headerClass: 'w-28',
				cellClass: 'w-28',
			},
		},
		{
			accessorKey: 'visibility',
			header: 'Visibility',
			cell: ({ row }) => {
				const paste = row.original;
				const visSnippet = createRawSnippet<[SinglePasteData]>((getPaste) => {
					const p = getPaste();
					const bgColor =
						p.visibility === 'PUBLIC'
							? 'bg-green-100'
							: p.visibility === 'AUTHENTICATED'
								? 'bg-blue-100'
								: p.visibility === 'INVITE_ONLY'
									? 'bg-yellow-100'
									: 'bg-red-100';
					const lockIcon = p.hasPassword
						? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-orange-600 dark:text-orange-400"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
						: '';
					return {
						render: () => `
							<div class="flex items-center gap-2">
								<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize dark:text-secondary ${bgColor}">
									${capitalizeFirstLetter(p.visibility.toLowerCase().replace('_', ' '))}
								</span>
								${lockIcon}
							</div>
						`,
					};
				});
				return renderSnippet(visSnippet, paste);
			},
			meta: {
				headerClass: 'w-32',
				cellClass: 'w-32',
			},
		},
		{
			accessorKey: 'views',
			header: 'Views',
			cell: ({ row }) => {
				const paste = row.original;
				const viewsSnippet = createRawSnippet<[number]>((getViews) => {
					const views = getViews();
					return {
						render: () => `<div class="text-left">${views.toLocaleString()}</div>`,
					};
				});
				return renderSnippet(viewsSnippet, paste.views);
			},
			meta: {
				headerClass: 'w-20',
				cellClass: 'w-20',
			},
		},
		{
			accessorKey: 'createdAt',
			header: 'Created',
			cell: ({ row }) => {
				const paste = row.original;
				const dateSnippet = createRawSnippet<[string | Date]>((getDate) => {
					const date = getDate();
					const formatted = new Date(date).toLocaleString();
					return {
						render: () =>
							`<div class="whitespace-nowrap text-sm text-muted-foreground" title="${formatted}">${formatted}</div>`,
					};
				});
				return renderSnippet(dateSnippet, paste.createdAt);
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

	const confirmDelete = (paste: SinglePasteData) => {
		pasteToDelete = paste;
		isDeleteDialogOpen = true;
	};
</script>

<svelte:head>
	<title>Dashboard - {getPublicSiteName()}</title>
</svelte:head>

<div class="container mx-auto px-4">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Dashboard</h1>
	</div>

	<!-- My Pastes Section -->
	<div class="w-full max-w-full">
		<!-- Search Bar -->
		<div class="mb-4 flex w-full max-w-md gap-2">
			<input
				type="text"
				placeholder="Search pastes..."
				class="h-8 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

		<!-- Error Display -->
		{#if data.error}
			<div class="mb-4 rounded-md bg-destructive/15 p-4 text-destructive">
				<p>{data.error}</p>
			</div>
		{/if}

		<!-- Pastes Table -->
		<DataTable
			bind:this={tableRef}
			{columns}
			data={userPastes}
			bind:pagination
			{isLoading}
			minWidth="800px"
			searchTerm={data.search}
			onOptimisticDelete={(deletedId) => {
				userPastes = userPastes.filter((paste) => paste.id !== deletedId);
			}}
		>
			{#snippet emptyState()}
				{#if data.search}
					No pastes found matching "{data.search}"
				{:else}
					No pastes created yet. <a
						href={resolve(ROUTES.HOME as Pathname)}
						class="text-primary hover:underline">Create your first paste!</a
					>
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
			<AlertDialogTitle>Are you sure you want to delete this paste?</AlertDialogTitle>
			<AlertDialogDescription>
				You are about to delete paste "{pasteToDelete?.title || `Paste ${pasteToDelete?.id}`}". This
				action cannot be undone.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Cancel</AlertDialogCancel>
			<form
				method="POST"
				action="?/deletePaste"
				use:enhance={() => {
					const toastId = toast.loading('Deleting paste...');

					return async ({ result }) => {
						isDeleteDialogOpen = false;
						toast.dismiss(toastId);

						if (result.type === 'success') {
							toast.success('Paste deleted successfully');
							// handle optimistic UI updates with proper pagination
							if (pasteToDelete?.id && tableRef) {
								await tableRef.handleOptimisticDeletion(pasteToDelete.id);
								await invalidateAll();
							}
						} else if (result.type === 'failure') {
							toast.error(`Failed to delete paste: ${result.data?.error || 'Unknown error'}`);
						} else {
							toast.error('An unexpected error occurred');
						}
					};
				}}
			>
				<input type="hidden" name="pasteId" value={pasteToDelete?.id || ''} />
				<AlertDialogAction type="submit">Delete</AlertDialogAction>
			</form>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
