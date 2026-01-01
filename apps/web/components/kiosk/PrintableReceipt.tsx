"use client";

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import QRCode from "qrcode";

// Receipt translations for different locales
const receiptTranslations: Record<
  string,
  {
    yourPod: string;
    orderNumber: string;
    queuePosition: string;
    estimatedWait: string;
    scanInstructions: string;
    scanAtPod: string;
    assigningSoon: string;
    thankYou: string;
    signUpCta: string;
  }
> = {
  en: {
    yourPod: "Your Pod",
    orderNumber: "Order",
    queuePosition: "Queue Position",
    estimatedWait: "~{minutes} min wait",
    scanInstructions:
      "Scan this QR code with your phone to track your order and unlock fun features!",
    scanAtPod: "Scan QR at your pod to check in",
    assigningSoon: "We'll assign your pod soon!",
    thankYou: "Thank you for dining with Oh!",
    signUpCta: "Sign up & earn rewards on this order!",
  },
  es: {
    yourPod: "Tu Pod",
    orderNumber: "Pedido",
    queuePosition: "Posicion en Cola",
    estimatedWait: "~{minutes} min de espera",
    scanInstructions:
      "Escanea este codigo QR con tu telefono para seguir tu pedido!",
    scanAtPod: "Escanea el QR en tu pod para registrarte",
    assigningSoon: "Te asignaremos un pod pronto!",
    thankYou: "Gracias por comer con Oh!",
    signUpCta: "Registrate y gana recompensas en este pedido!",
  },
  "zh-CN": {
    yourPod: "您的座位",
    orderNumber: "订单",
    queuePosition: "排队位置",
    estimatedWait: "约{minutes}分钟等待",
    scanInstructions: "用手机扫描此二维码追踪您的订单!",
    scanAtPod: "在座位扫描二维码签到",
    assigningSoon: "我们很快会为您安排座位!",
    thankYou: "感谢您在Oh!用餐!",
    signUpCta: "注册并在此订单上获得奖励!",
  },
  "zh-TW": {
    yourPod: "您的座位",
    orderNumber: "訂單",
    queuePosition: "排隊位置",
    estimatedWait: "約{minutes}分鐘等待",
    scanInstructions: "用手機掃描此二維碼追蹤您的訂單!",
    scanAtPod: "在座位掃描二維碼簽到",
    assigningSoon: "我們很快會為您安排座位!",
    thankYou: "感謝您在Oh!用餐!",
    signUpCta: "註冊並在此訂單上獲得獎勵!",
  },
};

function getTranslations(locale: string) {
  return receiptTranslations[locale] || receiptTranslations.en;
}

// Styles for thermal receipt (80mm = ~227 points at 72dpi)
const styles = StyleSheet.create({
  page: {
    padding: 16,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  brandName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  locationName: {
    fontSize: 9,
    color: "#666666",
  },
  guestSection: {
    alignItems: "center",
    marginBottom: 12,
  },
  guestName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 2,
  },
  orderNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#7C7A67",
  },
  qrSection: {
    alignItems: "center",
    marginVertical: 12,
  },
  qrCode: {
    width: 120,
    height: 120,
  },
  podSection: {
    alignItems: "center",
    marginVertical: 12,
    padding: 12,
    backgroundColor: "#f5f5f0",
    borderRadius: 6,
  },
  podLabel: {
    fontSize: 11,
    color: "#666666",
    marginBottom: 2,
  },
  podNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#7C7A67",
  },
  podHint: {
    fontSize: 9,
    color: "#666666",
    marginTop: 4,
  },
  queueSection: {
    alignItems: "center",
    marginVertical: 12,
    padding: 12,
    backgroundColor: "#fff8e6",
    borderRadius: 6,
  },
  queueLabel: {
    fontSize: 11,
    color: "#d97706",
    marginBottom: 2,
  },
  queueNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#d97706",
  },
  waitTime: {
    fontSize: 9,
    color: "#666666",
    marginTop: 4,
  },
  instructions: {
    textAlign: "center",
    fontSize: 9,
    color: "#666666",
    marginTop: 12,
    lineHeight: 1.4,
    paddingHorizontal: 8,
  },
  signupCta: {
    alignItems: "center",
    marginTop: 12,
    padding: 10,
    backgroundColor: "#7C7A67",
    borderRadius: 4,
  },
  signupText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#dddddd",
  },
  footerText: {
    fontSize: 8,
    color: "#999999",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    marginVertical: 8,
  },
});

export interface PrintableReceiptProps {
  guestName: string;
  orderNumber: string;
  dailyOrderNumber: string;
  qrCodeUrl: string;
  qrDataUrl?: string;
  podNumber?: string;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  locationName: string;
  locale?: string;
}

export function PrintableReceipt({
  guestName,
  dailyOrderNumber,
  qrDataUrl,
  podNumber,
  queuePosition,
  estimatedWaitMinutes,
  locationName,
  locale = "en",
}: PrintableReceiptProps) {
  const t = getTranslations(locale);

  return (
    <Document>
      <Page size={[227, 400]} style={styles.page}>
        {/* Header with logo */}
        <View style={styles.header}>
          <Image src="/Oh_Logo_Mark_Web.png" style={styles.logo} />
          <Text style={styles.brandName}>Oh! Beef Noodle</Text>
          <Text style={styles.locationName}>{locationName}</Text>
        </View>

        {/* Guest Name & Order Number */}
        <View style={styles.guestSection}>
          <Text style={styles.guestName}>{guestName}</Text>
          <Text style={styles.orderNumber}>#{dailyOrderNumber}</Text>
        </View>

        {/* QR Code */}
        {qrDataUrl && (
          <View style={styles.qrSection}>
            <Image src={qrDataUrl} style={styles.qrCode} />
          </View>
        )}

        {/* Pod or Queue Info */}
        {podNumber ? (
          <View style={styles.podSection}>
            <Text style={styles.podLabel}>{t.yourPod}</Text>
            <Text style={styles.podNumber}>Pod {podNumber}</Text>
            <Text style={styles.podHint}>{t.scanAtPod}</Text>
          </View>
        ) : queuePosition ? (
          <View style={styles.queueSection}>
            <Text style={styles.queueLabel}>{t.queuePosition}</Text>
            <Text style={styles.queueNumber}>#{queuePosition}</Text>
            {estimatedWaitMinutes && (
              <Text style={styles.waitTime}>
                {t.estimatedWait.replace("{minutes}", String(estimatedWaitMinutes))}
              </Text>
            )}
            <Text style={styles.podHint}>{t.assigningSoon}</Text>
          </View>
        ) : null}

        {/* Instructions */}
        <Text style={styles.instructions}>{t.scanInstructions}</Text>

        {/* Sign-up CTA */}
        <View style={styles.signupCta}>
          <Text style={styles.signupText}>{t.signUpCta}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t.thankYou}</Text>
          <Text style={styles.footerText}>ohbeefnoodle.com</Text>
        </View>
      </Page>
    </Document>
  );
}

// Helper function to generate QR code data URL
export async function generateQRDataUrl(url: string): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      width: 200,
      margin: 1,
      color: {
        dark: "#1a1a1a",
        light: "#ffffff",
      },
    });
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    return "";
  }
}
