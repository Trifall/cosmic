<script lang="ts">
	import type { DBUser } from '$database/schema';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
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
	import { Input } from '$lib/components/ui/input';
	import { Spinner } from '$lib/components/ui/spinner';
	import { searchUsers } from '$lib/remote/users.remote';
	import type { SinglePasteData } from '$lib/shared/pastes';
	import { changeOwner } from './admin-pastes.remote';

	interface Props {
		paste: SinglePasteData | null;
		isOpen: boolean;
		onClose: () => void;
	}

	let { paste, isOpen, onClose }: Props = $props();

	// modal state
	let isChangingOwner = $state(false);
	let userSearchQuery = $state('');
	let searchResults = $state<Partial<DBUser>[]>([]);
	let selectedNewOwner = $state<Partial<DBUser> | null>(null);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	// query for user search - only run when modal is open
	let userSearchParams = $state<{ q?: string; includeSelf?: boolean } | null>(null);
	const usersQuery = $derived(
		isOpen && userSearchParams ? searchUsers(userSearchParams) : { current: null, loading: false }
	);

	// reset state when modal opens
	$effect(() => {
		if (isOpen && paste) {
			selectedNewOwner = null;
			userSearchQuery = '';
			searchResults = [];
			// automatically fetch initial users
			userSearchParams = { includeSelf: true };
		}
	});

	// cleanup when modal closes
	$effect(() => {
		if (!isOpen) {
			userSearchQuery = '';
			searchResults = [];
			selectedNewOwner = null;
			userSearchParams = null;
			if (searchTimeout) {
				clearTimeout(searchTimeout);
				searchTimeout = null;
			}
		}
	});

	// user search effect with debounce
	$effect(() => {
		if (!isOpen) return;

		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		const trimmedQuery = userSearchQuery.trim();

		// if user typed something but not enough (1 char), don't search yet
		if (trimmedQuery.length === 1) {
			return;
		}

		// if search query is empty, refetch initial users (user cleared their search)
		if (trimmedQuery.length === 0) {
			userSearchParams = { includeSelf: true };
			return;
		}

		// user has typed 2+ characters, search with debounce
		searchTimeout = setTimeout(() => {
			userSearchParams = {
				q: userSearchQuery,
				includeSelf: true,
			};
		}, 300);
	});

	// process query results
	$effect(() => {
		const data = usersQuery.current;
		if (data?.users) {
			// filter out current owner
			searchResults = data.users.filter((user: Partial<DBUser>) => user.id !== paste?.owner_id);
		}
	});

	const selectNewOwner = (user: any) => {
		selectedNewOwner = user;
		// don't clear searchResults - let user see all results and switch between them
	};

	const handleClose = () => {
		if (!isChangingOwner) {
			onClose();
		}
	};
</script>

<AlertDialog open={isOpen} onOpenChange={(open: boolean) => !open && handleClose()}>
	<AlertDialogContent class="max-w-md">
		<AlertDialogHeader>
			<AlertDialogTitle>Change Paste Owner</AlertDialogTitle>
			<AlertDialogDescription>
				Change the owner of paste "{paste?.title || `Paste ${paste?.id}`}" from
				<strong>{paste?.ownerUsername}</strong> to a new user.
			</AlertDialogDescription>
		</AlertDialogHeader>

		<div class="space-y-4 py-4">
			<!-- User Search -->
			<div class="space-y-2">
				<label for="owner-search" class="text-sm font-medium">Search for new owner:</label>
				<Input
					id="owner-search"
					bind:value={userSearchQuery}
					placeholder="Search users..."
					class="border-border bg-background text-sm"
				/>

				<!-- Search Results Container - Fixed Height -->
				<div class="h-40 rounded border border-border bg-background">
					{#if usersQuery.loading}
						<div class="flex h-full items-center justify-center">
							<div class="flex items-center space-x-2 text-sm text-muted-foreground">
								<Spinner size={48} label="Searching..." />
							</div>
						</div>
					{:else if searchResults.length > 0}
						<div class="h-full space-y-1 overflow-y-auto p-1">
							{#each searchResults as user (user.id)}
								<button
									type="button"
									onclick={() => selectNewOwner(user)}
									class="block w-full border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-muted"
								>
									<div class="font-semibold text-foreground">{user.displayUsername}</div>
									<div class="text-sm text-muted-foreground">{user.email}</div>
								</button>
							{/each}
						</div>
					{:else if userSearchQuery.trim().length >= 2}
						<div class="flex h-full items-center justify-center">
							<div class="text-sm text-muted-foreground">No users found</div>
						</div>
					{:else}
						<div class="flex h-full items-center justify-center">
							<div class="text-sm text-muted-foreground">Start typing to search users...</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Selected User Display -->
			{#if selectedNewOwner}
				<div class="space-y-2">
					<div class="text-sm font-medium">Selected new owner:</div>
					<div class="rounded border border-border bg-muted/50 px-3 py-2">
						<div class="font-medium">{selectedNewOwner.displayUsername}</div>
						<div class="text-sm text-muted-foreground">{selectedNewOwner.email}</div>
					</div>
				</div>
			{/if}

			<!-- Confirmation -->
			{#if selectedNewOwner}
				<div class="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
					<p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
						Are you sure you want to change ownership of paste "{paste?.title ||
							`Paste ${paste?.id}`}" from
						<strong>{paste?.ownerUsername}</strong>
						to <strong>{selectedNewOwner.displayUsername}</strong>?
					</p>
					{#if paste?.visibility === 'INVITE_ONLY'}
						<p class="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
							Note: Since this is an invite-only paste, the previous owner will be automatically
							invited to maintain access.
						</p>
					{/if}
				</div>
			{/if}
		</div>

		<AlertDialogFooter>
			<AlertDialogCancel onclick={handleClose} disabled={isChangingOwner}>Cancel</AlertDialogCancel>
			<AlertDialogAction
				disabled={!selectedNewOwner || isChangingOwner}
				class="bg-orange-500 hover:bg-orange-600"
				onclick={async () => {
					if (!paste?.id || !selectedNewOwner?.id || !paste?.owner_id) return;

					isChangingOwner = true;
					const toastId = toast.loading('Changing paste owner...');

					try {
						// call remote function to change ownership
						await changeOwner({
							pasteId: paste.id,
							newOwnerId: selectedNewOwner.id,
							currentOwnerId: paste.owner_id,
						});

						isChangingOwner = false;
						toast.dismiss(toastId);
						toast.success('Paste ownership changed successfully');
						onClose();

						// revalidate page data to reflect ownership change in the table
						await invalidateAll();
					} catch (error) {
						isChangingOwner = false;
						toast.dismiss(toastId);
						toast.error(`Failed to change owner: ${error}`);
					}
				}}
			>
				{isChangingOwner ? 'Changing...' : 'Change Owner'}
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
