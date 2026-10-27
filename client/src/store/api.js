import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API } from '../lib/format';
import { logout, setScannerToken } from './authSlice';

const urlOf = (arg) => (typeof arg === 'string' ? arg : arg.url);

const raw = fetchBaseQuery({
  baseUrl: `${API}/api`,
  prepareHeaders: (headers, { getState, arg }) => {
    const { token, scannerToken } = getState().auth;
    const t = urlOf(arg).startsWith('/scanner') ? scannerToken || token : token;
    if (t) headers.set('authorization', `Bearer ${t}`);
    return headers;
  },
});

// If the server says our session is invalid, sign the person out so they see the sign-in page instead of broken screens.
const baseQuery = async (args, api, extra) => {
  const result = await raw(args, api, extra);
  if (result.error?.status === 401) {
    const url = urlOf(args);
    if (!url.endsWith('/login')) {
      if (url.startsWith('/scanner')) api.dispatch(setScannerToken(null));
      else api.dispatch(logout());
    }
  }
  return result;
};

const GENERIC = 'Something went wrong. Please try again in a moment.';

/** Turns any RTK Query error into a calm, human sentence. Raw technical text is never shown to people. */
export function errMsg(e) {
  if (!e) return GENERIC;
  if (e.status === 'FETCH_ERROR') return "We can't reach the server. Please check your internet connection and try again.";
  if (e.status === 'TIMEOUT_ERROR') return 'This is taking longer than expected. Please try again.';
  if (e.status === 'PARSING_ERROR') return 'Something went wrong on our side. Please try again in a moment.';
  if (typeof e.data?.message === 'string' && e.data.message) return e.data.message;
  if (typeof e.status === 'number' && e.status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
  return GENERIC;
}

const body = (url, method = 'POST') => (b) => ({ url, method, body: b });

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['PublicEvent', 'TicketView', 'Overview', 'Event', 'Tiers', 'Attendees', 'Orders', 'Promos', 'Payouts', 'Activity', 'Ledger', 'Emails', 'Settings', 'ScanStats'],
  endpoints: (b) => ({
    /* ---------- public ---------- */
    getEvent: b.query({ query: () => '/event', providesTags: ['PublicEvent'] }),
    validatePromo: b.mutation({ query: body('/promo/validate') }),
    checkout: b.mutation({ query: body('/orders/checkout') }),
    getOrder: b.query({ query: (ref) => `/orders/${ref}` }),
    getTicket: b.query({ query: (token) => `/tickets/view/${token}`, providesTags: ['TicketView'] }),
    transferTicket: b.mutation({
      query: ({ token, ...rest }) => ({ url: `/tickets/transfer/${token}`, method: 'POST', body: rest }),
      invalidatesTags: ['TicketView'],
    }),
    findTicket: b.mutation({ query: body('/tickets/find') }),

    /* ---------- auth ---------- */
    login: b.mutation({ query: body('/auth/login') }),
    changePassword: b.mutation({ query: body('/auth/change-password') }),

    /* ---------- host console ---------- */
    cOverview: b.query({ query: () => '/console/overview', providesTags: ['Overview'] }),
    cEvent: b.query({ query: () => '/console/event', providesTags: ['Event'] }),
    patchEvent: b.mutation({ query: body('/console/event', 'PATCH'), invalidatesTags: ['Event', 'PublicEvent', 'Overview', 'Activity'] }),
    cTiers: b.query({ query: () => '/console/tiers', providesTags: ['Tiers'] }),
    createTier: b.mutation({ query: body('/console/tiers'), invalidatesTags: ['Tiers', 'PublicEvent', 'Overview', 'Activity'] }),
    updateTier: b.mutation({
      query: ({ id, ...rest }) => ({ url: `/console/tiers/${id}`, method: 'PATCH', body: rest }),
      invalidatesTags: ['Tiers', 'PublicEvent', 'Overview', 'Activity'],
    }),
    deleteTier: b.mutation({
      query: (id) => ({ url: `/console/tiers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Tiers', 'PublicEvent', 'Overview', 'Activity'],
    }),
    attendees: b.query({ query: (params) => ({ url: '/console/attendees', params }), providesTags: ['Attendees'] }),
    resendTicket: b.mutation({ query: (id) => ({ url: `/console/tickets/${id}/resend`, method: 'POST' }), invalidatesTags: ['Activity'] }),
    voidTicket: b.mutation({
      query: ({ id, reason }) => ({ url: `/console/tickets/${id}/void`, method: 'POST', body: { reason } }),
      invalidatesTags: ['Attendees', 'Overview', 'Tiers', 'Activity', 'PublicEvent'],
    }),
    manualTickets: b.mutation({
      query: body('/console/tickets/manual'),
      invalidatesTags: ['Attendees', 'Overview', 'Tiers', 'Orders', 'Activity', 'PublicEvent'],
    }),
    cOrders: b.query({ query: (params) => ({ url: '/console/orders', params }), providesTags: ['Orders'] }),
    promos: b.query({ query: () => '/console/promos', providesTags: ['Promos'] }),
    createPromo: b.mutation({ query: body('/console/promos'), invalidatesTags: ['Promos', 'Activity'] }),
    togglePromo: b.mutation({
      query: ({ id, active }) => ({ url: `/console/promos/${id}`, method: 'PATCH', body: { active } }),
      invalidatesTags: ['Promos', 'Activity'],
    }),
    deletePromo: b.mutation({ query: (id) => ({ url: `/console/promos/${id}`, method: 'DELETE' }), invalidatesTags: ['Promos', 'Activity'] }),
    cPayouts: b.query({ query: () => '/console/payouts', providesTags: ['Payouts'] }),
    activity: b.query({ query: (params) => ({ url: '/console/activity', params }), providesTags: ['Activity'] }),

    /* ---------- platform admin ---------- */
    aOverview: b.query({ query: () => '/admin/overview', providesTags: ['Overview'] }),
    ledger: b.query({ query: (params) => ({ url: '/admin/ledger', params }), providesTags: ['Ledger'] }),
    aPayouts: b.query({ query: () => '/admin/payouts', providesTags: ['Payouts'] }),
    recordPayout: b.mutation({ query: body('/admin/payouts'), invalidatesTags: ['Payouts', 'Overview', 'Activity'] }),
    settings: b.query({ query: () => '/admin/settings', providesTags: ['Settings'] }),
    patchSettings: b.mutation({ query: body('/admin/settings', 'PATCH'), invalidatesTags: ['Settings', 'Overview', 'Activity', 'Event'] }),
    hostAccount: b.mutation({ query: body('/admin/host-account', 'PUT'), invalidatesTags: ['Settings', 'Activity'] }),
    emails: b.query({ query: (params) => ({ url: '/admin/emails', params }), providesTags: ['Emails'] }),
    retryEmail: b.mutation({ query: (id) => ({ url: `/admin/emails/${id}/retry`, method: 'POST' }), invalidatesTags: ['Emails', 'Overview'] }),
    reconcile: b.mutation({ query: () => ({ url: '/admin/reconcile', method: 'POST' }), invalidatesTags: ['Overview', 'Ledger', 'Orders', 'Emails', 'Attendees'] }),
    refundOrder: b.mutation({
      query: ({ id, reason }) => ({ url: `/admin/orders/${id}/refund`, method: 'POST', body: { reason } }),
      invalidatesTags: ['Ledger', 'Orders', 'Overview', 'Attendees', 'Activity', 'Tiers', 'PublicEvent'],
    }),

    /* ---------- gate scanner ---------- */
    scannerLogin: b.mutation({ query: body('/scanner/login') }),
    scan: b.mutation({ query: body('/scanner/scan'), invalidatesTags: ['ScanStats'] }),
    manifest: b.query({ query: () => '/scanner/manifest' }),
    syncScans: b.mutation({ query: body('/scanner/sync'), invalidatesTags: ['ScanStats'] }),
    scanStats: b.query({ query: () => '/scanner/stats', providesTags: ['ScanStats'] }),
  }),
});

export const {
  useGetEventQuery,
  useValidatePromoMutation,
  useCheckoutMutation,
  useGetOrderQuery,
  useGetTicketQuery,
  useTransferTicketMutation,
  useFindTicketMutation,
  useLoginMutation,
  useChangePasswordMutation,
  useCOverviewQuery,
  useCEventQuery,
  usePatchEventMutation,
  useCTiersQuery,
  useCreateTierMutation,
  useUpdateTierMutation,
  useDeleteTierMutation,
  useAttendeesQuery,
  useResendTicketMutation,
  useVoidTicketMutation,
  useManualTicketsMutation,
  useCOrdersQuery,
  usePromosQuery,
  useCreatePromoMutation,
  useTogglePromoMutation,
  useDeletePromoMutation,
  useCPayoutsQuery,
  useActivityQuery,
  useAOverviewQuery,
  useLedgerQuery,
  useAPayoutsQuery,
  useRecordPayoutMutation,
  useSettingsQuery,
  usePatchSettingsMutation,
  useHostAccountMutation,
  useEmailsQuery,
  useRetryEmailMutation,
  useReconcileMutation,
  useRefundOrderMutation,
  useScannerLoginMutation,
  useScanMutation,
  useManifestQuery,
  useSyncScansMutation,
  useScanStatsQuery,
} = api;
