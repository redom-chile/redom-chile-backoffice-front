import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, concatMap, from, Observable, throwError } from 'rxjs';
import { HelpChatEvent, HelpChatRequestDto } from './dtos';
import { HELP_BASE } from './help.service';

const EVENT_NAMES = new Set<HelpChatEvent['event']>(['articles', 'delta', 'done', 'error']);

/** Lee los eventos completos (separados por línea en blanco) y deja en `rest` lo que aún no termina de llegar. */
export function parseSseChunk(buffer: string): { events: HelpChatEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: HelpChatEvent[] = [];
  for (const block of blocks) {
    let name = '';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) name = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (!EVENT_NAMES.has(name as HelpChatEvent['event']) || !data.length) continue;
    try {
      events.push({ event: name, data: JSON.parse(data.join('\n')) } as HelpChatEvent);
    } catch {
      // Evento mal formado: se ignora.
    }
  }
  return { events, rest };
}

/**
 * Asistente con IA (POST /help/chat, text/event-stream).
 * Va por HttpClient (y no fetch suelto) para que el interceptor ponga el Bearer y renueve el token;
 * con reportProgress y responseType 'text' cada progreso trae todo el texto recibido hasta ahora.
 * Desuscribirse aborta la petición. En AWS la respuesta puede llegar completa al final: el parser es el mismo.
 * Los errores previos al stream (429 HELP_QUOTA_EXCEEDED / HELP_RATE_LIMITED, 400) llegan como HttpErrorResponse
 * con el cuerpo JSON ya parseado, para leerlos con readApiError.
 */
@Injectable({ providedIn: 'root' })
export class HelpChatService {
  readonly #http = inject(HttpClient);

  ask(dto: HelpChatRequestDto): Observable<HelpChatEvent> {
    let consumed = 0;
    let buffer = '';
    const take = (text: string, flush = false): HelpChatEvent[] => {
      buffer += text.slice(consumed);
      consumed = text.length;
      const { events, rest } = parseSseChunk(flush ? `${buffer}\n\n` : buffer);
      buffer = flush ? '' : rest;
      return events;
    };

    return this.#http
      .post(`${HELP_BASE}/chat`, dto, {
        observe: 'events',
        reportProgress: true,
        responseType: 'text',
        headers: { Accept: 'text/event-stream' },
      })
      .pipe(
        concatMap((event) => {
          if (event.type === HttpEventType.DownloadProgress) return from(take(event.partialText ?? ''));
          if (event.type === HttpEventType.Response) return from(take(event.body ?? '', true));
          return from([]);
        }),
        catchError((error: unknown) => throwError(() => withJsonBody(error))),
      );
  }
}

// Con responseType 'text' el cuerpo del error llega como texto.
function withJsonBody(error: unknown): unknown {
  if (!(error instanceof HttpErrorResponse) || typeof error.error !== 'string') return error;
  try {
    return new HttpErrorResponse({
      error: JSON.parse(error.error),
      headers: error.headers,
      status: error.status,
      statusText: error.statusText,
      url: error.url ?? undefined,
    });
  } catch {
    return error;
  }
}
