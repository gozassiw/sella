import { getMyStore } from "@/lib/store";
import SettingsForm from "@/components/SettingsForm";
import { SITE_URL } from "@/lib/config";
import CloseAccountForm from "@/components/CloseAccountForm";

export default async function SettingsPage() {
  const { store, user } = await getMyStore();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Store settings</h1>
      <SettingsForm store={store} userId={user.id} siteUrl={SITE_URL} />
      <CloseAccountForm role="seller" />
    </div>
  );
}
