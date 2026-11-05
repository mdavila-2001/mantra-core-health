import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { sinNulos } from '../wire';
import type { Topic } from './community.types';

/** Writes on the community topic tree (`/community/topics`). */
@Injectable({ providedIn: 'root' })
export class CommunityTopicsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /community/topics` — creates an own topic under «Temas propios».
   * If one with that name already exists, the API returns it.
   */
  createTopic(name: string): Observable<Topic> {
    return this.http
      .post<Topic>(apiUrl(this.baseUrl, '/community/topics'), { name })
      .pipe(map((body) => sinNulos(body)));
  }
}
