import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPasswordPolicy } from "@/lib/password-policy-server";
import { ResetForm } from "./_components/reset-form";

export default async function ResetKataLaluanPage() {
  const policy = await getPasswordPolicy();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 to-green-700 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">M</span>
            </div>
          </div>
          <CardTitle className="text-xl font-bold text-green-900">Tetapkan Kata Laluan</CardTitle>
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
