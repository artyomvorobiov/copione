import { Screen } from '@/components/layout';
import { ProfileView } from '@/components/ProfileView';
import { useBackend } from '@/state/session';

export default function MyProfileScreen() {
  const backend = useBackend();
  return (
    <Screen>
      <ProfileView userId={backend.userId} asTab />
    </Screen>
  );
}
