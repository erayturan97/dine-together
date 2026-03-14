import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { useApi } from '@/hooks/useApi';
import { User } from '@/contexts/GroupContext';

type ContactsResult = {
  matched: User[];
  loading: boolean;
  permissionDenied: boolean;
  fetch: () => Promise<void>;
};

export function useContactsMatch(): ContactsResult {
  const { apiFetch } = useApi();
  const [matched, setMatched] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const fetchContacts = useCallback(async () => {
    if (Platform.OS === 'web') {
      setMatched([]);
      return;
    }

    setLoading(true);
    setPermissionDenied(false);

    try {
      const Contacts = await import('expo-contacts');
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });

      const phones: string[] = [];
      const emails: string[] = [];

      for (const contact of data) {
        if (contact.phoneNumbers) {
          for (const ph of contact.phoneNumbers) {
            if (ph.number) phones.push(ph.number);
          }
        }
        if (contact.emails) {
          for (const em of contact.emails) {
            if (em.email) emails.push(em.email);
          }
        }
      }

      const result = await apiFetch('/users/contacts-match', {
        method: 'POST',
        body: JSON.stringify({ phones, emails }),
      });

      setMatched(result ?? []);
    } catch {
      setMatched([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  return { matched, loading, permissionDenied, fetch: fetchContacts };
}
