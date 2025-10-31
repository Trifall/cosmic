<script lang="ts">
	import type { DBUser } from '$database/schema';
	import { Input } from '@/src/lib/components/ui/input';
	import type { InvitedUser, Visibility } from '@/src/lib/shared/pastes';
	import { User, X } from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
	import { searchUsers } from '$lib/remote/users.remote';
	import { formatEmail } from '$src/lib/utils/format';

	/**
	 * User Invite Selector
	 *
	 * @param visibility - The visibility of the paste
	 * @param removedUsers - The users that have been removed from the paste
	 * @param selectedUsers - The users that have been selected for the paste
	 * @param invitedUsers - The users that have been invited to the paste
	 * @param pasteId - The id of the paste
	 *
	 * If you are using this component, make sure to bind the selectedUsers and removedUsers props.
	 * If you dont have previously invited users, dont pass removedUsers or invitedUsers props.
	 *
	 *
	 */

	type UserInviteSelectorProps = {
		visibility: Visibility;
		removedUsers?: string[];
		selectedUsers: Partial<DBUser>[];
		invitedUsers?: InvitedUser[];
		pasteId?: string;
		disabled?: boolean;
	};

	let {
		visibility,
		removedUsers = $bindable(),
		selectedUsers = $bindable(),
		invitedUsers,
		pasteId,
		disabled = false,
	}: UserInviteSelectorProps = $props();

	let userSearchQuery = $state('');
	let searchResults = $state<Partial<DBUser>[]>([]);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	// reactive query based on search input
	let searchQueryParams = $state<{ q?: string; pasteId?: string; includeSelf?: boolean }>({});
	const usersQuery = $derived(searchUsers(searchQueryParams));

	// user search with debounce
	$effect(() => {
		if (visibility !== 'INVITE_ONLY') {
			userSearchQuery = '';
			searchResults = [];
			selectedUsers = [];
			return;
		}

		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		if (userSearchQuery.trim().length < 2) {
			searchResults = [];
			return;
		}

		searchTimeout = setTimeout(() => {
			// trigger query with search params
			searchQueryParams = {
				q: userSearchQuery,
				pasteId: pasteId,
				includeSelf: false,
			};
		}, 300);
	});

	// process query results
	$effect(() => {
		const data = usersQuery.current;
		if (data?.users) {
			// filter out already selected users and invited users (that havent been removed)
			const currentlyInvitedIds = invitedUsers
				?.filter((user) => user.id && !removedUsers?.includes(user.id))
				.map((user) => user.id!);

			searchResults = data.users.filter(
				(user) =>
					user.id &&
					!selectedUsers.some((selected) => selected.id === user.id) &&
					!currentlyInvitedIds?.includes(user.id)
			);
		}
	});

	const addUser = (user: any) => {
		if (!selectedUsers.some((selected) => selected.id === user.id)) {
			selectedUsers = [...selectedUsers, user];
			searchResults = searchResults.filter((result) => result.id !== user.id);
		}
	};

	const removeUser = (userId: string) => {
		selectedUsers = selectedUsers.filter((user) => user.id !== userId);
	};

	const removeCurrentInvite = (userId: string) => {
		if (removedUsers && !removedUsers.includes(userId)) {
			removedUsers = [...removedUsers, userId];
		}
	};

	// fetch initial users when clicking in search box
	const fetchAllUsers = () => {
		if (usersQuery.loading || searchResults.length > 0) return;

		// trigger query without search term to get first 10 users
		searchQueryParams = {
			pasteId: pasteId,
			includeSelf: false,
		};
	};
</script>

<!-- User Search for INVITE_ONLY -->
{#if visibility === 'INVITE_ONLY'}
	<div class="mt-3 space-y-2">
		<!-- Currently Invited Users -->
		{#if invitedUsers && invitedUsers?.filter((user) => user.id && !removedUsers?.includes(user.id)).length > 0}
			<div class="space-y-2">
				<div class="text-sm font-medium text-foreground">
					Currently Invited Users ({invitedUsers?.filter(
						(user) => user.id && !removedUsers?.includes(user.id)
					).length}):
				</div>
				<div class="max-h-40 overflow-y-auto rounded border border-border bg-background">
					{#each invitedUsers.filter((user) => user.id && !removedUsers?.includes(user.id)) as invitedUser (invitedUser.id)}
						<div
							class="flexitems-center justify-between border-b border-border px-3 py-2 last:border-b-0"
						>
							<div class="flex max-w-full items-center gap-1">
								<button
									type="button"
									onclick={() => removeCurrentInvite(invitedUser.id)}
									class="text-red-500 hover:text-red-400"
									title="Remove user"
									{disabled}
								>
									<X size={16} />
								</button>
								<User size={16} class="min-w-[16px] text-muted-foreground" />
								<span class="truncate text-sm font-medium text-foreground">
									{invitedUser.displayUsername || invitedUser.username}
								</span>
								<span class="ml-auto min-w-[90px] text-xs text-muted-foreground">
									({formatDistanceToNow(new Date(invitedUser.invitedAt), {
										addSuffix: true,
									})})
								</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
		<div class="text-sm text-muted-foreground">Search and select users to invite:</div>

		<!-- Search Input -->
		<Input
			bind:value={userSearchQuery}
			placeholder="Search users..."
			class="border-border bg-background text-sm"
			onclick={fetchAllUsers}
			{disabled}
		/>

		<!-- Search Results -->
		{#if usersQuery.loading}
			<div class="text-sm text-muted-foreground">Searching...</div>
		{:else if searchResults.length > 0}
			<div
				class="max-h-40 max-w-full space-y-1 overflow-y-auto rounded border border-border bg-background"
			>
				{#each searchResults as user (user.id)}
					<button
						type="button"
						onclick={() => addUser(user)}
						class="block w-full border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-muted"
						{disabled}
					>
						<div title={user.displayUsername} class="truncate font-semibold text-foreground">
							{user.displayUsername}
						</div>
						<div title={formatEmail(user.email)} class="truncate text-sm text-muted-foreground">
							{formatEmail(user.email)}
						</div>
					</button>
				{/each}
			</div>
		{:else if userSearchQuery.trim().length >= 2}
			<div class="text-sm text-muted-foreground">No users found</div>
		{/if}

		<!-- Selected Users Tags -->
		{#if selectedUsers.length > 0}
			<div class="mt-2 flex flex-wrap gap-2">
				{#each selectedUsers as user (user.id)}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-1 text-xs"
					>
						{user.displayUsername}
						<button
							type="button"
							onclick={() => removeUser(user.id!)}
							class="text-orange-400 hover:text-orange-300"
							title="Remove user"
							{disabled}
						>
							×
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>
{/if}
