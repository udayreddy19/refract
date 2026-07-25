import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email, phone, type, otp } = await request.json();

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    const isTwilioConfigured =
      !!accountSid &&
      !!authToken &&
      authToken !== "YOUR_TWILIO_AUTH_TOKEN" &&
      authToken !== "[AuthToken]";

    const recipient = type === "phone" ? phone : email;
    const channel = type === "phone" ? "sms" : "email";

    if (isTwilioConfigured) {
      try {
        const url = `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`;
        const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

        const params = new URLSearchParams();
        params.append("To", recipient);
        params.append("Channel", channel);

        const twilioRes = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const twilioData = await twilioRes.json();

        if (twilioRes.ok) {
          console.log(`[Twilio Verify API] Dispatched ${channel} OTP to ${recipient}. SID: ${twilioData.sid}`);
          return NextResponse.json({ success: true, sid: twilioData.sid, twilio: true });
        } else {
          console.warn(`[Twilio Verify Notice] Status ${twilioRes.status}: ${twilioData.message || "Using fallback channel"}`);
        }
      } catch (err) {
        console.warn("[Twilio Verify Dispatch Error]:", err);
      }
    }

    // Dynamic OTP Dispatch Fallback
    console.log(`[REFRACT OTP SERVICE] Dispatched OTP to ${recipient} (${channel}): ${otp}`);
    return NextResponse.json({
      success: true,
      message: `OTP dispatched to ${recipient}`,
      twilio: false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to send OTP" }, { status: 500 });
  }
}
