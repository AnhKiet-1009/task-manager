import type { RealtimeEvent } from "@taskmanager/shared";

export type EventSubscriber = (event: RealtimeEvent) => void;

/**
 * Adapter interface for real-time workspace event broadcasting.
 * V1 uses InMemoryEventBus (zero cost); commercial scale swaps in
 * Redis Pub/Sub or Cloudflare Durable Objects without touching routes or FE.
 */
export interface RealtimeEventBus {
  publish(event: RealtimeEvent): void;
  subscribe(workspaceId: string, listener: EventSubscriber): () => void;
  getSubscriberCount(workspaceId: string): number;
}

export class InMemoryEventBus implements RealtimeEventBus {
  private readonly channels = new Map<string, Set<EventSubscriber>>();

  publish(event: RealtimeEvent): void {
    const subscribers = this.channels.get(event.workspaceId);
    if (!subscribers || subscribers.size === 0) return;

    for (const listener of subscribers) {
      try {
        listener(event);
      } catch (error) {
        console.error("[EventBus] Listener failed:", error);
      }
    }
  }

  subscribe(workspaceId: string, listener: EventSubscriber): () => void {
    let subscribers = this.channels.get(workspaceId);
    if (!subscribers) {
      subscribers = new Set();
      this.channels.set(workspaceId, subscribers);
    }
    subscribers.add(listener);

    return () => {
      const current = this.channels.get(workspaceId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.channels.delete(workspaceId);
      }
    };
  }

  getSubscriberCount(workspaceId: string): number {
    return this.channels.get(workspaceId)?.size ?? 0;
  }
}

export const eventBus: RealtimeEventBus = new InMemoryEventBus();
