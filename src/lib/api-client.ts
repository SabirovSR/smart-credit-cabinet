import type { ApplicationDTO } from "@/contracts/application";
export class ClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public fieldErrors: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      ...(!(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.includes("/auth/login"))
      window.location.assign("/login");
    throw new ClientError(
      result.error?.code ?? "NETWORK_ERROR",
      result.error?.message ?? "Не удалось выполнить запрос.",
      result.error?.fieldErrors,
    );
  }
  return result.data as T;
}
export type CompanyDTO = {
  id: string;
  legalName: string;
  inn: string;
  legalForm: string;
  okved: string;
  industry: string;
  demoDefaults: {
    monthlyRevenueRub: number;
    monthlyOperatingExpensesRub: number;
  } | null;
};
export type ArticleDTO = {
  id: string;
  title: string;
  summary: string;
  body?: string[];
  relevanceReason: string;
  isDemoMaterial: boolean;
};
export type ListItem = Pick<
  ApplicationDTO,
  | "id"
  | "purpose"
  | "status"
  | "version"
  | "requestedAmountRub"
  | "createdAt"
  | "updatedAt"
  | "productCode"
>;
