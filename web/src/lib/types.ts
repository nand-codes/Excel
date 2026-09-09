export interface Client {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  name: string;
  phone: string;
  alternatePhone: string | null;
  applicationNumber: string | null;
  guardianName: string | null;
  dob: string;
  bloodGroup: string;
  licenceType: string;
  address: string;
}

/** The fields the form owns. Ids and timestamps belong to the server. */
export interface ClientInput {
  id?: string;
  name: string;
  phone: string;
  alternatePhone: string | null;
  applicationNumber: string | null;
  guardianName: string | null;
  dob: string;
  bloodGroup: string;
  licenceType: string;
  address: string;
}

export interface Payment {
  id: string;
  clientId: string;
  amount: number;
  paidAt: string;
  method: string | null;
  note: string | null;
}

export interface PaymentInput {
  clientId: string;
  amount: number;
  date: string;
  method: string | null;
  note: string | null;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'staff';
}

export interface ImportResult {
  added: number;
  skipped: number;
  rejected: number;
}
