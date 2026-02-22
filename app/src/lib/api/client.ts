import { useServerStore } from '@/stores/serverStore';
import type { LanguageCode } from '@/lib/constants/languages';
import { VoiceboxAppError } from '@/lib/errors';
import type {
  VoiceProfileCreate,
  VoiceProfileResponse,
  ProfileSampleResponse,
  GenerationRequest,
  GenerationResponse,
  HistoryQuery,
  HistoryListResponse,
  HistoryResponse,
  TranscriptionResponse,
  HealthResponse,
  ModelStatusListResponse,
  ModelDownloadRequest,
  ActiveTasksResponse,
  StoryCreate,
  StoryResponse,
  StoryDetailResponse,
  StoryItemCreate,
  StoryItemDetail,
  StoryItemBatchUpdate,
  StoryItemReorder,
  StoryItemMove,
  StoryItemTrim,
  StoryItemSplit,
  VoiceCloneReferencePolicyResponse,
} from './types';

class ApiClient {
  private getBaseUrl(): string {
    const serverUrl = useServerStore.getState().serverUrl;
    return serverUrl;
  }

  private inferAction(endpoint: string, method: string): string {
    const normalized = endpoint.toLowerCase();
    if (normalized === '/profiles' && method === 'GET') return 'load voice profiles';
    if (normalized.includes('/samples') && method === 'POST') return 'upload voice sample';
    if (normalized.includes('/transcribe')) return 'transcribe audio';
    if (normalized.includes('/generate')) return 'generate speech';
    if (normalized.includes('/history')) return 'load generation history';
    if (normalized.includes('/models')) return 'manage model state';
    if (normalized.includes('/stories')) return 'load story data';
    if (normalized.includes('/health')) return 'check server health';
    if (normalized.includes('/voice-clone/policy')) return 'load voice clone policy';
    if (normalized.includes('/channels')) return 'load channel configuration';

    const fallbackVerb =
      method === 'GET'
        ? 'load'
        : method === 'POST'
          ? 'submit'
          : method === 'PUT'
            ? 'update'
            : method === 'DELETE'
              ? 'delete'
              : 'process';
    return `${fallbackVerb} request`;
  }

  private buildHint({
    status,
    networkError,
    serverUrl,
  }: {
    status?: number;
    networkError?: string;
    serverUrl: string;
  }): string {
    if (networkError) {
      return `Could not reach ${serverUrl}. Check if the Voicebox backend is running and the server URL is correct.`;
    }
    if (status === 400 || status === 422) {
      return 'The request data is invalid. Review the form inputs and try again.';
    }
    if (status === 401 || status === 403) {
      return 'The request was rejected by the server due to permission rules.';
    }
    if (status === 404) {
      return 'The requested resource was not found. It may have been removed or the server route changed.';
    }
    if (status === 409) {
      return 'The operation conflicts with current state. Refresh and retry.';
    }
    if (status && status >= 500) {
      return 'The server encountered an internal error. Retry shortly or check backend logs.';
    }
    return 'Retry the action. If the issue persists, copy the technical details and report it.';
  }

  private toErrorDetailString(detail: unknown): string {
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object') {
      return JSON.stringify(detail, null, 2);
    }
    return 'No additional server detail';
  }

  private createApiError(params: {
    endpoint: string;
    method: string;
    url: string;
    status?: number;
    statusText?: string;
    requestId?: string;
    serverDetail?: unknown;
    networkError?: string;
  }): VoiceboxAppError {
    const { endpoint, method, url, status, statusText, requestId, serverDetail, networkError } = params;
    const action = this.inferAction(endpoint, method);
    const baseUrl = this.getBaseUrl();
    const detailMessage = this.toErrorDetailString(serverDetail);

    const summary = networkError
      ? `Could not ${action} because the server connection failed.`
      : `Failed to ${action}${status ? ` (HTTP ${status})` : ''}.`;

    const technicalLines = [
      `Request: ${method} ${url}`,
      ...(status ? [`Status: ${status}${statusText ? ` ${statusText}` : ''}`] : []),
      ...(requestId ? [`Request ID: ${requestId}`] : []),
      ...(networkError ? [`Network error: ${networkError}`] : [`Server detail: ${detailMessage}`]),
    ];

    return new VoiceboxAppError({
      title: `Unable to ${action.charAt(0).toUpperCase()}${action.slice(1)}`,
      summary,
      hint: this.buildHint({ status, networkError, serverUrl: baseUrl }),
      technical: technicalLines.join('\n'),
      requestId,
      status,
      endpoint,
      method,
    });
  }

  private async parseResponsePayload(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text().catch(() => '');
      return text || null;
    }
    return response.json().catch(() => null);
  }

  private async requestJson<T>(
    endpoint: string,
    options?: RequestInit,
    includeJsonContentType = true,
  ): Promise<T> {
    const method = options?.method || 'GET';
    const url = `${this.getBaseUrl()}${endpoint}`;

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          ...(includeJsonContentType ? { 'Content-Type': 'application/json' } : {}),
          ...options?.headers,
        },
      });
    } catch (error) {
      throw this.createApiError({
        endpoint,
        method,
        url,
        networkError: error instanceof Error ? error.message : String(error),
      });
    }

    if (!response.ok) {
      const payload = await this.parseResponsePayload(response);
      const payloadRequestId =
        payload && typeof payload === 'object'
          ? ((payload as Record<string, unknown>).error as Record<string, unknown> | undefined)
              ?.request_id
          : undefined;
      const requestId =
        response.headers.get('x-request-id') ??
        (typeof payloadRequestId === 'string' ? payloadRequestId : undefined);
      let serverDetail: unknown = response.statusText;
      if (payload && typeof payload === 'object') {
        const payloadObj = payload as Record<string, unknown>;
        serverDetail =
          payloadObj.detail ??
          (payloadObj.error as Record<string, unknown> | undefined)?.message ??
          payload;
      } else if (payload) {
        serverDetail = payload;
      }
      throw this.createApiError({
        endpoint,
        method,
        url,
        status: response.status,
        statusText: response.statusText,
        requestId,
        serverDetail,
      });
    }

    // Some endpoints may return empty responses on success.
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  private async requestBlob(endpoint: string, options?: RequestInit): Promise<Blob> {
    const method = options?.method || 'GET';
    const url = `${this.getBaseUrl()}${endpoint}`;

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      throw this.createApiError({
        endpoint,
        method,
        url,
        networkError: error instanceof Error ? error.message : String(error),
      });
    }

    if (!response.ok) {
      const payload = await this.parseResponsePayload(response);
      const payloadRequestId =
        payload && typeof payload === 'object'
          ? ((payload as Record<string, unknown>).error as Record<string, unknown> | undefined)
              ?.request_id
          : undefined;
      const requestId =
        response.headers.get('x-request-id') ??
        (typeof payloadRequestId === 'string' ? payloadRequestId : undefined);
      throw this.createApiError({
        endpoint,
        method,
        url,
        status: response.status,
        statusText: response.statusText,
        requestId,
        serverDetail:
          (payload as Record<string, unknown> | null)?.detail ??
          (payload as Record<string, unknown> | null)?.error ??
          payload,
      });
    }

    return response.blob();
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.requestJson<T>(endpoint, options, true);
  }

  // Health
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  // Profiles
  async createProfile(data: VoiceProfileCreate): Promise<VoiceProfileResponse> {
    return this.request<VoiceProfileResponse>('/profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listProfiles(): Promise<VoiceProfileResponse[]> {
    return this.request<VoiceProfileResponse[]>('/profiles');
  }

  async getProfile(profileId: string): Promise<VoiceProfileResponse> {
    return this.request<VoiceProfileResponse>(`/profiles/${profileId}`);
  }

  async updateProfile(profileId: string, data: VoiceProfileCreate): Promise<VoiceProfileResponse> {
    return this.request<VoiceProfileResponse>(`/profiles/${profileId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProfile(profileId: string): Promise<void> {
    await this.request<void>(`/profiles/${profileId}`, {
      method: 'DELETE',
    });
  }

  async addProfileSample(
    profileId: string,
    file: File,
    referenceText: string,
  ): Promise<ProfileSampleResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('reference_text', referenceText);
    return this.requestJson<ProfileSampleResponse>(
      `/profiles/${profileId}/samples`,
      { method: 'POST', body: formData },
      false,
    );
  }

  async getVoiceCloneReferencePolicy(): Promise<VoiceCloneReferencePolicyResponse> {
    return this.request<VoiceCloneReferencePolicyResponse>('/voice-clone/policy');
  }

  async listProfileSamples(profileId: string): Promise<ProfileSampleResponse[]> {
    return this.request<ProfileSampleResponse[]>(`/profiles/${profileId}/samples`);
  }

  async deleteProfileSample(sampleId: string): Promise<void> {
    await this.request<void>(`/profiles/samples/${sampleId}`, {
      method: 'DELETE',
    });
  }

  async updateProfileSample(
    sampleId: string,
    referenceText: string,
  ): Promise<ProfileSampleResponse> {
    return this.request<ProfileSampleResponse>(`/profiles/samples/${sampleId}`, {
      method: 'PUT',
      body: JSON.stringify({ reference_text: referenceText }),
    });
  }

  async exportProfile(profileId: string): Promise<Blob> {
    return this.requestBlob(`/profiles/${profileId}/export`);
  }

  async importProfile(file: File): Promise<VoiceProfileResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.requestJson<VoiceProfileResponse>(
      '/profiles/import',
      { method: 'POST', body: formData },
      false,
    );
  }

  async uploadAvatar(profileId: string, file: File): Promise<VoiceProfileResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.requestJson<VoiceProfileResponse>(
      `/profiles/${profileId}/avatar`,
      { method: 'POST', body: formData },
      false,
    );
  }

  async deleteAvatar(profileId: string): Promise<void> {
    await this.request<void>(`/profiles/${profileId}/avatar`, {
      method: 'DELETE',
    });
  }

  // Generation
  async generateSpeech(data: GenerationRequest): Promise<GenerationResponse> {
    return this.request<GenerationResponse>('/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // History
  async listHistory(query?: HistoryQuery): Promise<HistoryListResponse> {
    const params = new URLSearchParams();
    if (query?.profile_id) params.append('profile_id', query.profile_id);
    if (query?.search) params.append('search', query.search);
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.offset) params.append('offset', query.offset.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/history?${queryString}` : '/history';

    return this.request<HistoryListResponse>(endpoint);
  }

  async getGeneration(generationId: string): Promise<HistoryResponse> {
    return this.request<HistoryResponse>(`/history/${generationId}`);
  }

  async deleteGeneration(generationId: string): Promise<void> {
    await this.request<void>(`/history/${generationId}`, {
      method: 'DELETE',
    });
  }

  async exportGeneration(generationId: string): Promise<Blob> {
    return this.requestBlob(`/history/${generationId}/export`);
  }

  async exportGenerationAudio(generationId: string): Promise<Blob> {
    return this.requestBlob(`/history/${generationId}/export-audio`);
  }

  async importGeneration(file: File): Promise<{ id: string; profile_id: string; profile_name: string; text: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.requestJson<{ id: string; profile_id: string; profile_name: string; text: string; message: string }>(
      '/history/import',
      { method: 'POST', body: formData },
      false,
    );
  }

  // Audio
  getAudioUrl(audioId: string): string {
    return `${this.getBaseUrl()}/audio/${audioId}`;
  }

  getSampleUrl(sampleId: string): string {
    return `${this.getBaseUrl()}/samples/${sampleId}`;
  }

  // Transcription
  async transcribeAudio(file: File, language?: LanguageCode): Promise<TranscriptionResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (language) {
      formData.append('language', language);
    }

    return this.requestJson<TranscriptionResponse>(
      '/transcribe',
      { method: 'POST', body: formData },
      false,
    );
  }

  // Model Management
  async getModelStatus(): Promise<ModelStatusListResponse> {
    return this.request<ModelStatusListResponse>('/models/status');
  }

  async triggerModelDownload(modelName: string): Promise<{ message: string }> {
    console.log('[API] triggerModelDownload called for:', modelName, 'at', new Date().toISOString());
    const result = await this.request<{ message: string }>('/models/download', {
      method: 'POST',
      body: JSON.stringify({ model_name: modelName } as ModelDownloadRequest),
    });
    console.log('[API] triggerModelDownload response:', result);
    return result;
  }

  async deleteModel(modelName: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/models/${modelName}`, {
      method: 'DELETE',
    });
  }

  // Task Management
  async getActiveTasks(): Promise<ActiveTasksResponse> {
    return this.request<ActiveTasksResponse>('/tasks/active');
  }

  // Audio Channels
  async listChannels(): Promise<
    Array<{
      id: string;
      name: string;
      is_default: boolean;
      device_ids: string[];
      created_at: string;
    }>
  > {
    return this.request('/channels');
  }

  async createChannel(data: {
    name: string;
    device_ids: string[];
  }): Promise<{
    id: string;
    name: string;
    is_default: boolean;
    device_ids: string[];
    created_at: string;
  }> {
    return this.request('/channels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChannel(
    channelId: string,
    data: {
      name?: string;
      device_ids?: string[];
    },
  ): Promise<{
    id: string;
    name: string;
    is_default: boolean;
    device_ids: string[];
    created_at: string;
  }> {
    return this.request(`/channels/${channelId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteChannel(channelId: string): Promise<{ message: string }> {
    return this.request(`/channels/${channelId}`, {
      method: 'DELETE',
    });
  }

  async getChannelVoices(channelId: string): Promise<{ profile_ids: string[] }> {
    return this.request(`/channels/${channelId}/voices`);
  }

  async setChannelVoices(
    channelId: string,
    profileIds: string[],
  ): Promise<{ message: string }> {
    return this.request(`/channels/${channelId}/voices`, {
      method: 'PUT',
      body: JSON.stringify({ profile_ids: profileIds }),
    });
  }

  async getProfileChannels(profileId: string): Promise<{ channel_ids: string[] }> {
    return this.request(`/profiles/${profileId}/channels`);
  }

  async setProfileChannels(
    profileId: string,
    channelIds: string[],
  ): Promise<{ message: string }> {
    return this.request(`/profiles/${profileId}/channels`, {
      method: 'PUT',
      body: JSON.stringify({ channel_ids: channelIds }),
    });
  }

  // Stories
  async listStories(): Promise<StoryResponse[]> {
    return this.request<StoryResponse[]>('/stories');
  }

  async createStory(data: StoryCreate): Promise<StoryResponse> {
    return this.request<StoryResponse>('/stories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStory(storyId: string): Promise<StoryDetailResponse> {
    return this.request<StoryDetailResponse>(`/stories/${storyId}`);
  }

  async updateStory(storyId: string, data: StoryCreate): Promise<StoryResponse> {
    return this.request<StoryResponse>(`/stories/${storyId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStory(storyId: string): Promise<void> {
    await this.request<void>(`/stories/${storyId}`, {
      method: 'DELETE',
    });
  }

  async addStoryItem(storyId: string, data: StoryItemCreate): Promise<StoryItemDetail> {
    return this.request<StoryItemDetail>(`/stories/${storyId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeStoryItem(storyId: string, itemId: string): Promise<void> {
    await this.request<void>(`/stories/${storyId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async updateStoryItemTimes(storyId: string, data: StoryItemBatchUpdate): Promise<void> {
    await this.request<void>(`/stories/${storyId}/items/times`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async reorderStoryItems(storyId: string, data: StoryItemReorder): Promise<StoryItemDetail[]> {
    return this.request<StoryItemDetail[]>(`/stories/${storyId}/items/reorder`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async moveStoryItem(storyId: string, itemId: string, data: StoryItemMove): Promise<StoryItemDetail> {
    return this.request<StoryItemDetail>(`/stories/${storyId}/items/${itemId}/move`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async trimStoryItem(storyId: string, itemId: string, data: StoryItemTrim): Promise<StoryItemDetail> {
    return this.request<StoryItemDetail>(`/stories/${storyId}/items/${itemId}/trim`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async splitStoryItem(storyId: string, itemId: string, data: StoryItemSplit): Promise<StoryItemDetail[]> {
    return this.request<StoryItemDetail[]>(`/stories/${storyId}/items/${itemId}/split`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async duplicateStoryItem(storyId: string, itemId: string): Promise<StoryItemDetail> {
    return this.request<StoryItemDetail>(`/stories/${storyId}/items/${itemId}/duplicate`, {
      method: 'POST',
    });
  }

  async exportStoryAudio(storyId: string): Promise<Blob> {
    return this.requestBlob(`/stories/${storyId}/export-audio`);
  }
}

export const apiClient = new ApiClient();
