export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPasswordPolicy } from "@/lib/password-policy-server";
import { ResetForm } from "./_components/reset-form";

export default async function ResetKataLaluanPage() {
  const policy = await getPasswordPolicy();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar to-primary p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">M</span>
            </div>
          </div>
          <CardTitle className="text-xl font-bold text-primary">Tetapkan Kata Laluan</CardTitle>
          <CardDescription>Cipta kata laluan baru untuk akaun anda</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-center text-gray-500">Memuatkan...</p>}>
            <ResetForm policy={policy} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
