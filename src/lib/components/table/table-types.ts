// oxlint-disable no-unused-vars
// extend TanStack Table ColumnMeta type for custom properties
declare module '@tanstack/table-core' {
	interface ColumnMeta<TData, TValue> {
		headerClass?: string;
		cellClass?: string;
	}
}

export {};
