import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_URL } from './config';
import type {
  AccountData, AdminThemeDetail, AdminThemeRow, AuthAnswer, Dashboard, Done, LessonDetail, ParentsData, Release, Settings, SiteData, User,
} from './types';

/** Every call to the API. Components use the generated hooks, e.g. useGetSiteQuery(). */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as { auth: { token: string | null } }).auth.token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Site', 'Account', 'Dashboard', 'Settings', 'Themes', 'Theme', 'Lesson', 'Releases', 'Parents'],
  endpoints: (b) => ({
    // ---------------------------------------------------------------- public
    getSite: b.query<SiteData, void>({ query: () => 'site', providesTags: ['Site'] }),

    // ---------------------------------------------------------------- accounts
    login: b.mutation<AuthAnswer, { email: string; password: string }>({
      query: (body) => ({ url: 'auth/login', method: 'POST', body }),
    }),
    register: b.mutation<AuthAnswer, Record<string, unknown>>({
      query: (body) => ({ url: 'auth/register', method: 'POST', body }),
    }),
    me: b.query<{ ok: boolean; user: User }, void>({ query: () => 'auth/me' }),
    setupStatus: b.query<{ needed: boolean }, void>({ query: () => 'auth/setup' }),
    setupAdmin: b.mutation<AuthAnswer, { name: string; email: string; password: string; password2: string }>({
      query: (body) => ({ url: 'auth/setup', method: 'POST', body }),
    }),

    // ---------------------------------------------------------------- parent's account
    getAccount: b.query<AccountData, void>({ query: () => 'account', providesTags: ['Account'] }),
    updateAccount: b.mutation<{ ok: boolean; user: User }, { name: string; city: string; country: string }>({
      query: (body) => ({ url: 'account', method: 'PATCH', body }),
      invalidatesTags: ['Account'],
    }),
    changePassword: b.mutation<Done, { current: string; new: string }>({
      query: (body) => ({ url: 'account/password', method: 'POST', body }),
    }),
    deleteAccount: b.mutation<Done, { password: string }>({
      query: (body) => ({ url: 'account/delete', method: 'POST', body }),
    }),
    downloadLink: b.mutation<{ url: string; version: string }, string>({
      query: (platform) => ({ url: `account/download/${platform}`, method: 'POST' }),
    }),

    // ---------------------------------------------------------------- admin
    dashboard: b.query<Dashboard, void>({ query: () => 'admin/dashboard', providesTags: ['Dashboard'] }),
    adminSettings: b.query<Settings, void>({ query: () => 'admin/settings', providesTags: ['Settings'] }),
    saveSettings: b.mutation<Done, Settings>({
      query: (body) => ({ url: 'admin/settings', method: 'PUT', body }),
      invalidatesTags: ['Settings', 'Site'],
    }),

    themes: b.query<AdminThemeRow[], void>({ query: () => 'admin/themes', providesTags: ['Themes'] }),
    theme: b.query<AdminThemeDetail, number>({ query: (id) => `admin/themes/${id}`, providesTags: (_r, _e, id) => [{ type: 'Theme', id }] }),
    createTheme: b.mutation<Done, FormData>({
      query: (body) => ({ url: 'admin/themes', method: 'POST', body }),
      invalidatesTags: ['Themes', 'Site', 'Dashboard', 'Parents'],
    }),
    updateTheme: b.mutation<Done, { id: number; form: FormData }>({
      query: ({ id, form }) => ({ url: `admin/themes/${id}`, method: 'PUT', body: form }),
      invalidatesTags: (_r, _e, { id }) => ['Themes', 'Site', 'Dashboard', 'Parents', { type: 'Theme', id }],
    }),
    deleteTheme: b.mutation<Done, number>({
      query: (id) => ({ url: `admin/themes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Themes', 'Site', 'Dashboard', 'Parents'],
    }),
    copyLessons: b.mutation<Done & { copied: number }, { id: number; from: number }>({
      query: ({ id, from }) => ({ url: `admin/themes/${id}/copy`, method: 'POST', body: { from } }),
      invalidatesTags: (_r, _e, { id }) => ['Themes', 'Dashboard', { type: 'Theme', id }],
    }),

    lesson: b.query<LessonDetail, number>({ query: (id) => `admin/lessons/${id}`, providesTags: (_r, _e, id) => [{ type: 'Lesson', id }] }),
    blankLesson: b.query<LessonDetail, number>({ query: (themeId) => `admin/lessons/new/${themeId}` }),
    createLesson: b.mutation<Done, FormData>({
      query: (body) => ({ url: 'admin/lessons', method: 'POST', body }),
      invalidatesTags: ['Themes', 'Theme', 'Dashboard', 'Site'],
    }),
    updateLesson: b.mutation<Done, { id: number; form: FormData }>({
      query: ({ id, form }) => ({ url: `admin/lessons/${id}`, method: 'PUT', body: form }),
      invalidatesTags: (_r, _e, { id }) => ['Themes', 'Theme', 'Dashboard', 'Site', { type: 'Lesson', id }],
    }),
    deleteLesson: b.mutation<Done, number>({
      query: (id) => ({ url: `admin/lessons/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Themes', 'Theme', 'Dashboard', 'Site'],
    }),
    moveLesson: b.mutation<Done, { id: number; direction: 'up' | 'down' }>({
      query: ({ id, direction }) => ({ url: `admin/lessons/${id}/move`, method: 'POST', body: { direction } }),
      invalidatesTags: ['Theme', 'Site'],
    }),

    releases: b.query<Release[], void>({ query: () => 'admin/releases', providesTags: ['Releases'] }),
    uploadRelease: b.mutation<Done, FormData>({
      query: (body) => ({ url: 'admin/releases', method: 'POST', body }),
      invalidatesTags: ['Releases', 'Dashboard', 'Site'],
    }),
    makeLatest: b.mutation<Done, number>({
      query: (id) => ({ url: `admin/releases/${id}/latest`, method: 'POST' }),
      invalidatesTags: ['Releases', 'Dashboard', 'Site'],
    }),
    deleteRelease: b.mutation<Done, number>({
      query: (id) => ({ url: `admin/releases/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Releases', 'Dashboard'],
    }),

    parents: b.query<ParentsData, string>({ query: (q) => ({ url: 'admin/parents', params: q ? { q } : undefined }), providesTags: ['Parents'] }),
    toggleParent: b.mutation<Done, number>({
      query: (id) => ({ url: `admin/parents/${id}/toggle`, method: 'POST' }),
      invalidatesTags: ['Parents'],
    }),
    saveParentPlan: b.mutation<Done, { id: number; plan: string; licences: Record<string, string> }>({
      query: ({ id, ...body }) => ({ url: `admin/parents/${id}/plan`, method: 'PUT', body }),
      invalidatesTags: ['Parents'],
    }),
    deleteParent: b.mutation<Done, number>({
      query: (id) => ({ url: `admin/parents/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Parents', 'Dashboard'],
    }),
  }),
});

export const {
  useGetSiteQuery, useLoginMutation, useRegisterMutation, useMeQuery, useSetupStatusQuery, useSetupAdminMutation,
  useGetAccountQuery, useUpdateAccountMutation, useChangePasswordMutation, useDeleteAccountMutation, useDownloadLinkMutation,
  useDashboardQuery, useAdminSettingsQuery, useSaveSettingsMutation,
  useThemesQuery, useThemeQuery, useCreateThemeMutation, useUpdateThemeMutation, useDeleteThemeMutation, useCopyLessonsMutation,
  useLessonQuery, useBlankLessonQuery, useCreateLessonMutation, useUpdateLessonMutation, useDeleteLessonMutation, useMoveLessonMutation,
  useReleasesQuery, useUploadReleaseMutation, useMakeLatestMutation, useDeleteReleaseMutation,
  useParentsQuery, useToggleParentMutation, useSaveParentPlanMutation, useDeleteParentMutation,
} = api;
