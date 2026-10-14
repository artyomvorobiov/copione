import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/layout';
import { ProfileView } from '@/components/ProfileView';
import { ErrorState } from '@/components/ui';

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return <ErrorState />;
  return (
    <Screen>
      <ProfileView userId={id} />
    </Screen>
  );
}
