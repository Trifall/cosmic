<script lang="ts">
	import { User } from '@lucide/svelte';
	import type { InvitedUser } from '$src/lib/shared/pastes';
	import { formatDateRelativeToNow } from '$src/lib/utils/format';

	let { invitedUsers }: { invitedUsers: InvitedUser[] } = $props();
</script>

<div class="mt-4">
	<div class="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
		Invited Users ({invitedUsers.length})
	</div>
	<div class="max-h-40 overflow-y-auto rounded border border-border bg-background">
		{#each invitedUsers as invitedUser (invitedUser.id)}
			<div class="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0">
				<User size={14} class="min-w-[14px] text-muted-foreground" />
				<span class="truncate text-xs font-medium text-foreground xl:text-sm">
					{invitedUser.displayUsername || invitedUser.username}
				</span>
				<span class="ml-auto min-w-[90px] text-xs text-muted-foreground">
					{formatDateRelativeToNow(new Date(invitedUser.invitedAt))}
				</span>
			</div>
		{/each}
	</div>
</div>
