import React, { useState } from "react";

import { Switch, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useNavigation } from "@react-navigation/native";

import DateTimePicker from "@react-native-community/datetimepicker";

import AppScreen from "../src/components/ui/AppScreen";

import AppButton from "../src/components/ui/AppButton";

import {
  EmptyState,
  FormRow,
  Group,
  ListRow,
  Notice,
  useAction,
} from "../src/components/ui/CommerceUI";
import { AppText } from "../src/contexts/TypographyContext";

import { useTheme } from "../src/contexts/ThemeContext";

import { useCurrency } from "../src/contexts/CurrencyContext";

import {
  billingSession,
  useCheckoutDraft,
} from "../src/services/billingSession";

import {
  calculateCartMoneyTotals,
  updateCartItemDiscount,
  updateCartQuantity,
  type CartItem,
} from "../src/domain/cart";

import { calculateSettlement } from "../src/domain/commerce";

import { toCents } from "../src/domain/money";

import { createSaleTransaction } from "../src/repositories/saleRepository";

import { notifyDataChanged } from "../src/services/dataEvents";

function CartLine({
  item,
  onError,
}: {
  item: CartItem;
  onError: (id: string, error: string) => void;
}) {
  const { theme } = useTheme();
  const currency = useCurrency();
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [discount, setDiscount] = useState(String(item.discount ?? 0));
  const [error, setError] = useState("");

  const edit = (value: string, kind: "quantity" | "discount") => {
    if (kind === "quantity") setQuantity(value);
    else setDiscount(value);
    try {
      if (!value.trim() || (kind === "quantity" && Number(value) <= 0))
        throw new Error("Enter a positive quantity, or remove the item.");
      const cart =
        kind === "quantity"
          ? updateCartQuantity(billingSession.getCart(), item.id, Number(value))
          : updateCartItemDiscount(
              billingSession.getCart(),
              item.id,
              toCents(value) / 100,
            );
      billingSession.setCart(cart);
      setError("");
      onError(item.id, "");
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      onError(item.id, message);
    }
  };

  return (
    <Group title={item.name} footer={error || undefined}>
      <ListRow
        title={`${currency.format(item.price)} per ${item.unit ?? "piece"}`}
        trailing={currency.format(item.total)}
      />
      <FormRow
        label={`Qty (${item.unit ?? "piece"})`}
        value={quantity}
        keyboardType="decimal-pad"
        onChangeText={(v) => edit(v, "quantity")}
      />
      <FormRow
        label="Line discount"
        value={discount}
        keyboardType="decimal-pad"
        onChangeText={(v) => edit(v, "discount")}
        trailing={<AppText style={{ color: theme.textSecondary, fontSize: 14 }}>{currency.symbol.trim()}</AppText>}
      />
      <ListRow
        title="Remove item"
        destructive
        chevron={false}
        onPress={() => {
          billingSession.setCart(
            billingSession.getCart().filter((c) => c.id !== item.id),
          );
          onError(item.id, "");
        }}
      />
    </Group>
  );
}

export default function BillReviewScreen() {
  const { theme } = useTheme();
  const currency = useCurrency();
  const navigation = useNavigation<any>();
  const draft = useCheckoutDraft();
  const action = useAction();
  const [details, setDetails] = useState(false);
  const [customer, setCustomer] = useState(false);
  const [split, setSplit] = useState(
    !!(billingSession.getSnapshot().upi || billingSession.getSnapshot().card),
  );
  const [datePicker, setDatePicker] = useState(false);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

  let validation = "";
  let totals = { subtotal: 0, discount: 0, tax: 0, total: 0 };
  let settlement = {
    paidCents: 0,
    dueCents: 0,
    changeCents: 0,
    payments: [] as any[],
  };
  let tenders: { method: string; amountCents: number }[] = [];

  try {
    totals = calculateCartMoneyTotals(
      draft.cart,
      toCents(draft.discount || "0") / 100,
      Number(draft.taxPercent || "0") / 100,
    );

    tenders = [
      ["Cash", draft.cash],
      ["UPI", draft.upi],
      ["Card", draft.card],
    ]
      .filter(([, amount]) => amount.trim() !== "")
      .map(([method, amount]) => ({ method, amountCents: toCents(amount) }))
      .filter((t) => t.amountCents !== 0);

    if (
      !draft.cash.trim() &&
      !draft.upi.trim() &&
      !draft.card.trim() &&
      !draft.allowCredit &&
      totals.total > 0
    )
      tenders = [{ method: "Cash", amountCents: toCents(totals.total) }];

    settlement = calculateSettlement(
      toCents(totals.total),
      tenders,
      draft.allowCredit,
    );

    if (settlement.dueCents > 0 && !draft.customerName.trim())
      validation = "Enter the customer name to keep an unpaid balance.";
  } catch (e) {
    validation = (e as Error).message;
  }

  const save = () =>
    action.run(async () => {
      if (validation || Object.values(lineErrors).some(Boolean))
        throw new Error(validation || "Correct the highlighted item values.");

      await billingSession.flush();

      const sale = await createSaleTransaction({
        id: draft.id,
        draftId: draft.id,
        customerId: draft.customerId,
        customerName: draft.customerName,
        customerPhone: draft.customerPhone,
        items: draft.cart.map((i) => ({
          barcode: i.id,
          quantity: i.quantity,
          unitPriceCents: toCents(i.price),
          discountCents: toCents(i.discount ?? 0),
        })),
        billDiscountCents: toCents(draft.discount || "0"),
        taxRate: Number(draft.taxPercent || "0") / 100,
        payments: tenders,
        allowCredit: draft.allowCredit,
        dueDate: draft.allowCredit ? draft.dueDate : undefined,
      });

      billingSession.clear();
      notifyDataChanged();
      navigation.reset({
        index: 1,
        routes: [
          { name: "MainTabs" },
          { name: "BillReceipt", params: { billId: sale.id } },
        ],
      });
    });

  const symbol = (
    <AppText style={{ color: theme.textSecondary, fontSize: 14 }}>{currency.symbol.trim()}</AppText>
  );
  const status =
    settlement.dueCents > 0
      ? `Due ${currency.format(settlement.dueCents / 100)}`
      : settlement.changeCents > 0
        ? `Change ${currency.format(settlement.changeCents / 100)}`
        : tenders.map((t) => t.method).join(" + ") || "Cash";

  return (
    <AppScreen
      theme={theme}
      keyboardAware
      footer={
        draft.cart.length ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8 }}>
            <Notice message={validation} error />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <AppText style={{ color: theme.textSecondary, fontSize: 12 }}>{status}</AppText>
                <AppText style={{ color: theme.text, fontSize: 22, fontWeight: "700", letterSpacing: -0.5 }}>
                  {currency.format(totals.total)}
                </AppText>
              </View>
              <AppButton
                theme={theme}
                icon="checkmark"
                label={settlement.dueCents > 0 ? "Save with credit" : "Complete bill"}
                loading={action.busy}
                disabled={!!validation || Object.values(lineErrors).some(Boolean)}
                onPress={save}
                style={{ paddingHorizontal: 20 }}
              />
            </View>
          </View>
        ) : undefined
      }
    >
      <Notice message={action.error || billingSession.getError()} error />
      {!draft.cart.length ? (
        <EmptyState icon="cart-outline" title="This bill is empty">
          <AppButton theme={theme} label="Add products" onPress={() => navigation.navigate("Billing")} />
        </EmptyState>
      ) : (
        <>
          <Group title="Items">
            {draft.cart.map((item) => (
              <ListRow
                key={item.id}
                title={item.name}
                subtitle={`${item.quantity} ${item.unit ?? "piece"} × ${currency.format(item.price)}`}
                trailing={currency.format(item.total)}
              />
            ))}
            <ListRow title="Edit items" onPress={() => navigation.goBack()} />
          </Group>
          <Group
            title="Payment"
            footer={
              draft.allowCredit
                ? "Whatever is not received now is recorded as customer credit."
                : "Leave cash blank to record the exact amount as cash."
            }
          >
            <FormRow
              label="Cash"
              value={draft.cash}
              onChangeText={(cash) => billingSession.update({ cash })}
              keyboardType="decimal-pad"
              placeholder={draft.allowCredit ? "0.00" : totals.total.toFixed(2)}
              trailing={symbol}
            />
            {split ? (
              <FormRow
                label="UPI"
                value={draft.upi}
                onChangeText={(upi) => billingSession.update({ upi })}
                keyboardType="decimal-pad"
                placeholder="0.00"
                trailing={symbol}
              />
            ) : null}
            {split ? (
              <FormRow
                label="Card"
                value={draft.card}
                onChangeText={(card) => billingSession.update({ card })}
                keyboardType="decimal-pad"
                placeholder="0.00"
                trailing={symbol}
              />
            ) : null}
            {!split ? (
              <ListRow
                icon="card"
                iconColor="#5856d6"
                title="Add UPI or card"
                subtitle="Split the payment"
                onPress={() => setSplit(true)}
              />
            ) : null}
            <ListRow
              icon="time"
              iconColor="#ff9500"
              title="Allow credit"
              subtitle="Collect the rest later"
              right={
                <Switch
                  accessibilityLabel="Allow credit"
                  value={draft.allowCredit}
                  onValueChange={(allowCredit) => billingSession.update({ allowCredit })}
                  trackColor={{ true: theme.success, false: theme.disabled }}
                  thumbColor="#fff"
                />
              }
            />
            {draft.allowCredit ? (
              <ListRow
                title="Due date"
                trailing={draft.dueDate ? new Date(draft.dueDate).toLocaleDateString() : "Optional"}
                onPress={() => setDatePicker(true)}
              />
            ) : null}
            {settlement.changeCents > 0 ? (
              <ListRow title="Change to return" trailing={currency.format(settlement.changeCents / 100)} />
            ) : null}
            {draft.allowCredit ? (
              <ListRow title="Remaining credit" trailing={currency.format(settlement.dueCents / 100)} />
            ) : null}
          </Group>
          {datePicker && (
            <DateTimePicker
              value={new Date(draft.dueDate ?? Date.now())}
              mode="date"
              onChange={(e, date) => {
                setDatePicker(false);
                if (e.type === "set" && date) {
                  date.setHours(23, 59, 59, 999);
                  billingSession.update({ dueDate: date.getTime() });
                }
              }}
            />
          )}
          <Group title={draft.allowCredit ? "Customer (required)" : "Customer (optional)"}>
            {customer || draft.allowCredit ? (
              <FormRow
                label="Name"
                value={draft.customerName}
                onChangeText={(customerName) =>
                  billingSession.update({ customerName, customerId: undefined })
                }
                placeholder={draft.allowCredit ? "Required" : "Walk-in"}
                autoCapitalize="words"
              />
            ) : null}
            {customer || draft.allowCredit ? (
              <FormRow
                label="Phone"
                value={draft.customerPhone}
                onChangeText={(customerPhone) =>
                  billingSession.update({ customerPhone, customerId: undefined })
                }
                keyboardType="phone-pad"
                maxLength={30}
                placeholder="Optional"
              />
            ) : (
              <ListRow icon="person" iconColor="#34c759" title="Add customer details" onPress={() => setCustomer(true)} />
            )}
          </Group>
          <Group>
            <ListRow
              icon="pricetag"
              iconColor="#8e8e93"
              title="Discounts & tax"
              subtitle="Optional"
              onPress={() => setDetails(!details)}
              chevron={false}
              right={<Ionicons name={details ? "chevron-up" : "chevron-down"} size={18} color={theme.placeholder} />}
            />
          </Group>
          {details && (
            <>
              {draft.cart.map((item) => (
                <CartLine
                  key={item.id}
                  item={item}
                  onError={(id, error) => setLineErrors((old) => ({ ...old, [id]: error }))}
                />
              ))}
              <Group title="Bill totals" footer="Tax is applied after discounts.">
                <FormRow
                  label="Bill discount"
                  value={draft.discount}
                  onChangeText={(discount) => billingSession.update({ discount })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  trailing={symbol}
                />
                <FormRow
                  label="Tax rate"
                  value={draft.taxPercent}
                  onChangeText={(taxPercent) => billingSession.update({ taxPercent })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  trailing={<AppText style={{ color: theme.textSecondary, fontSize: 14 }}>%</AppText>}
                />
                <ListRow title="Subtotal" trailing={currency.format(totals.subtotal)} />
                <ListRow title="Discount" trailing={currency.format(totals.discount)} />
                <ListRow title="Tax" trailing={currency.format(totals.tax)} />
                <ListRow title="Total" trailing={currency.format(totals.total)} />
              </Group>
            </>
          )}
          <Group>
            <ListRow
              icon="pause"
              iconColor="#ff9500"
              title="Park & finish later"
              onPress={() =>
                action.run(async () => {
                  await billingSession.park();
                  navigation.navigate("ParkedBills");
                })
              }
            />
          </Group>
        </>
      )}
    </AppScreen>
  );
}
