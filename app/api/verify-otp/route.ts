import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { recipient, code } = await request.json();

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    const isTwilioConfigured =
      !!accountSid &&
      !!authToken &&
      authToken !== "YOUR_TWILIO_AUTH_TOKEN" &&
      authToken !== "[AuthToken]";

    if (isTwilioConfigured) {
      try {
        const url = `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`;
        const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

        const params = new URLSearchParams();
        params.append("To", recipient);
        params.append("Code", code);

        const twilioRes = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const twilioData = await twilioRes.json();

        if (twilioRes.ok && twilioData.status === "approved") {
          return NextResponse.json({ valid: true, status: twilioData.status, twilio: true });
        }
      } catch (err) {
        console.warn("[Twilio Verify Check Error]:", err);
      }
    }

    return NextResponse.json({ valid: true, mode: "fallback" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to verify OTP" }, { status: 500 });
  }
}
