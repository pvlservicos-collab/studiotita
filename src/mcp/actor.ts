import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Guarda, por request, o identificador do cliente que está chamando o MCP
 * (vindo do header `x-client-name`), para auditoria em integration_logs e
 * para diferenciar múltiplos clientes usando o mesmo servidor.
 */
export const actorStorage = new AsyncLocalStorage<string>();

export function getActor(): string {
  return actorStorage.getStore() ?? "cliente_desconhecido";
}
