<script lang="ts" generics="TData, TValue">
	import { Spinner } from '@/src/lib/components/ui/spinner';
	import {
		type ColumnDef,
		type ColumnFiltersState,
		type SortingState,
		type VisibilityState,
		getCoreRowModel,
		getFilteredRowModel,
		getSortedRowModel,
	} from '@tanstack/table-core';
	import type { Snippet } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { Button } from '$lib/components/ui/button/index.js';
	import { FlexRender, createSvelteTable } from '$lib/components/ui/data-table/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import {
		getPaginationPreloadUrl,
		handleNextPage,
		handlePreviousPage,
	} from '$src/lib/utils/pagination';
	// import type extensions
	import type {} from './table-types.js';

	export interface PaginationConfig {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	}

	interface Props<TData, TValue> {
		columns: ColumnDef<TData, TValue>[];
		data: TData[];
		pagination?: PaginationConfig;
		isLoading?: boolean;
		minWidth?: string;
		skeletonRows?: number;
		searchTerm?: string;
		onOptimisticDelete?: (deletedItemId: string) => void;
		// snippet for empty state
		emptyState?: Snippet<[string | undefined]>;
	}

	let {
		columns,
		data = $bindable(),
		pagination = $bindable(),
		isLoading = false,
		minWidth = '1000px',
		skeletonRows = 5,
		searchTerm,
		onOptimisticDelete,
		emptyState,
	}: Props<TData, TValue> = $props();

	// tanstack table state - keep minimal since we use server-side pagination
	let sorting = $state<SortingState>([]);
	let columnFilters = $state<ColumnFiltersState>([]);
	let columnVisibility = $state<VisibilityState>({});

	// create table instance with manual pagination (server-side)
	const table = createSvelteTable({
		get data() {
			return data;
		},
		columns,
		state: {
			get sorting() {
				return sorting;
			},
			get columnFilters() {
				return columnFilters;
			},
			get columnVisibility() {
				return columnVisibility;
			},
		},
		onSortingChange: (updater) => {
			if (typeof updater === 'function') {
				sorting = updater(sorting);
			} else {
				sorting = updater;
			}
		},
		onColumnFiltersChange: (updater) => {
			if (typeof updater === 'function') {
				columnFilters = updater(columnFilters);
			} else {
				columnFilters = updater;
			}
		},
		onColumnVisibilityChange: (updater) => {
			if (typeof updater === 'function') {
				columnVisibility = updater(columnVisibility);
			} else {
				columnVisibility = updater;
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		// disable client-side pagination - we use server-side pagination
		manualPagination: true,
	});

	// optimistic deletion handler for backward compatibility
	export const handleOptimisticDeletion = async (deletedItemId: string) => {
		if (!pagination) return;

		const currentPage = pagination.page;

		// call parents delete handler if provided (for custom state management)
		if (onOptimisticDelete) {
			onOptimisticDelete(deletedItemId);
		}

		// remove item from the list
		const originalLength = data.length;
		data = data.filter((item: any) => item.id !== deletedItemId);

		// only proceed if we actually removed an item
		if (data.length === originalLength) {
			return; // item wasnt found in current list
		}

		// calculate new pagination data
		const newTotal = pagination.total - 1;
		const newTotalPages = Math.ceil(newTotal / pagination.limit);

		// handle case where we deleted all items
		if (newTotal === 0) {
			// update pagination and stay on current page (pagination will be hidden)
			pagination = {
				...pagination,
				total: 0,
				totalPages: 0,
			};
			return;
		}

		// check if current page becomes empty after deletion
		const currentPageBecomesEmpty = data.length === 0;

		// if current page becomes empty and we are not on page 1, redirect to previous page
		if (currentPageBecomesEmpty && currentPage > 1) {
			const targetPage = Math.min(currentPage - 1, newTotalPages);
			const url = new URL(window.location.href);
			url.searchParams.set('page', targetPage.toString());
			goto(resolve((url.pathname + url.search) as Pathname));
			return;
		}

		// if current page becomes empty and we are on page 1 but there are still items,
		// we need fresh data from the server
		if (currentPageBecomesEmpty && currentPage === 1 && newTotal > 0) {
			await invalidateAll();
			return;
		}

		// if we are on a page thats now higher than the total pages (edge case)
		if (currentPage > newTotalPages) {
			const url = new URL(window.location.href);
			url.searchParams.set('page', newTotalPages.toString());
			goto(resolve((url.pathname + url.search) as Pathname));
			return;
		}

		// simple case: just update pagination count (current page still has content)
		pagination = {
			...pagination,
			total: newTotal,
			totalPages: newTotalPages,
		};
	};
</script>

<!-- Table Container -->
<div class="w-full">
	{#if isLoading && data.length === 0}
		<!-- Loading Skeleton -->
		<div class="relative overflow-x-auto rounded-xl bg-white dark:bg-zinc-900/90">
			<div class="absolute left-1/2 top-1/3 z-[50] -translate-x-1/2">
				<Spinner size={48} />
			</div>
			<div class="rounded-md border" style="min-width: {minWidth}">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							{#each columns as column (column.id)}
								<Table.Head>{column.header || ''}</Table.Head>
							{/each}
						</Table.Row>
					</Table.Header>
					<Table.Body>
						<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
						{#each Array(skeletonRows) as _, i (i)}
							<Table.Row>
								<Table.Cell colspan={columns.length} class="px-4 py-3">
									<div class="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		</div>
	{:else}
		<!-- Data Table -->
		<div class="relative overflow-x-auto rounded-xl bg-white dark:bg-zinc-900/90">
			<div class="rounded-md border" style="min-width: {minWidth}">
				<Table.Root>
					<Table.Header>
						{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
							<Table.Row>
								{#each headerGroup.headers as header (header.id)}
									<Table.Head
										colspan={header.colSpan}
										class="{header.column.columnDef.meta?.headerClass ||
											''} {header.column.getCanSort()
											? 'cursor-pointer select-none hover:bg-muted dark:hover:bg-gray-700'
											: ''}"
										onclick={header.column.getCanSort()
											? header.column.getToggleSortingHandler()
											: undefined}
									>
										{#if !header.isPlaceholder}
											<div class="flex items-center gap-2">
												<FlexRender
													content={header.column.columnDef.header}
													context={header.getContext()}
												/>
												{#if header.column.getCanSort()}
													{#if header.column.getIsSorted() === 'asc'}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															width="14"
															height="14"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
															stroke-linecap="round"
															stroke-linejoin="round"
														>
															<path d="m18 15-6-6-6 6" />
														</svg>
													{:else if header.column.getIsSorted() === 'desc'}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															width="14"
															height="14"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
															stroke-linecap="round"
															stroke-linejoin="round"
														>
															<path d="m6 9 6 6 6-6" />
														</svg>
													{/if}
												{/if}
											</div>
										{/if}
									</Table.Head>
								{/each}
							</Table.Row>
						{/each}
					</Table.Header>
					<Table.Body>
						{#each table.getRowModel().rows as row (row.id)}
							<Table.Row data-state={row.getIsSelected() && 'selected'}>
								{#each row.getVisibleCells() as cell (cell.id)}
									<Table.Cell class={cell.column.columnDef.meta?.cellClass || ''}>
										<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
									</Table.Cell>
								{/each}
							</Table.Row>
						{:else}
							<Table.Row>
								<Table.Cell colspan={columns.length} class="h-24 text-center">
									{#if emptyState}
										{@render emptyState(searchTerm)}
									{:else if searchTerm}
										No results found matching "{searchTerm}"
									{:else}
										No results.
									{/if}
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		</div>
	{/if}
</div>

<!-- Pagination -->
{#if pagination && pagination.total > 0}
	<div class="flex items-center justify-end space-x-2 pt-4">
		<div class="relative">
			<Button
				variant="outline"
				size="sm"
				onclick={() => handlePreviousPage(pagination!)}
				disabled={pagination.page <= 1}
			>
				Previous
			</Button>
			{#if pagination.page > 1}
				<a
					href={resolve(getPaginationPreloadUrl(pagination, 'previous', true) as Pathname)}
					data-sveltekit-preload-data="hover"
					class="absolute left-0 top-0 h-full w-full rounded-md opacity-0"
					aria-hidden="true"
				>
					Previous
				</a>
			{/if}
		</div>
		<div class="text-sm text-muted-foreground">
			Page {pagination.page} of {pagination.totalPages}
		</div>
		<div class="relative">
			<Button
				variant="outline"
				size="sm"
				onclick={() => handleNextPage(pagination!)}
				disabled={pagination.page >= pagination.totalPages}
			>
				Next
			</Button>
			{#if pagination.page < pagination.totalPages}
				<a
					href={resolve(getPaginationPreloadUrl(pagination, 'next', true) as Pathname)}
					data-sveltekit-preload-data="hover"
					class="absolute left-0 top-0 h-full w-full rounded-md opacity-0"
					aria-hidden="true"
				>
					Next
				</a>
			{/if}
		</div>
	</div>
{/if}
