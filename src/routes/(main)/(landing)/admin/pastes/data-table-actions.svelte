<script lang="ts">
	import { Copy, EllipsisIcon, Eye, SquarePen, Trash2Icon, UserX } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger,
	} from '$lib/components/ui/dropdown-menu';
	import type { SinglePasteData } from '$lib/shared/pastes';

	let {
		paste,
		onDelete,
		onChangeOwner,
	}: {
		paste: SinglePasteData;
		onDelete: (paste: SinglePasteData) => void;
		onChangeOwner: (paste: SinglePasteData) => void;
	} = $props();

	const getViewUrl = (p: SinglePasteData) => {
		return `/${p.customSlug || p.id}`;
	};

	const copyPasteUrl = async () => {
		const url = window.location.origin + getViewUrl(paste);
		try {
			await navigator.clipboard.writeText(url);
			toast.success('Copied paste URL to clipboard');
		} catch (error) {
			console.error('Failed to copy to clipboard:', error);
			toast.error('Failed to copy to clipboard');
		}
	};
</script>

<div class="flex gap-1">
	<a
		href={resolve(getViewUrl(paste) as Pathname)}
		class="group flex items-center justify-center rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
		title="View paste"
	>
		<Eye size={16} class="group-hover:stroke-blue-400" />
	</a>
	<button
		onclick={() => window.open(`${resolve(getViewUrl(paste) as Pathname)}/edit`, '_blank')}
		class="group flex items-center justify-center rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
		title="Edit paste"
	>
		<SquarePen size={16} class="group-hover:stroke-green-400" />
	</button>
	<button
		onclick={() => onDelete(paste)}
		class="group flex items-center justify-center rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
		title="Delete paste"
	>
		<Trash2Icon size={16} class="group-hover:stroke-red-400" />
	</button>
	<button
		onclick={copyPasteUrl}
		class="group flex items-center justify-center rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
		title="Copy Paste URL"
	>
		<Copy size={16} class="group-hover:stroke-blue-400" />
	</button>

	<!-- More actions dropdown -->
	<DropdownMenu>
		<DropdownMenuTrigger
			class="group flex items-center justify-center rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
			title="More actions"
		>
			<EllipsisIcon size={16} class="group-hover:stroke-gray-400" />
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end">
			<DropdownMenuItem onclick={() => onChangeOwner(paste)} class="cursor-pointer">
				<UserX class="mr-2 h-4 w-4" />
				Change Owner
			</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
</div>
