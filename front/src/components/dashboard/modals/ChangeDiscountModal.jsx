// front/src/components/dashboard/modals/ChangeDiscountModal.jsx
import { useState } from "react";
import { getPromotions } from "../../../data/candidateStore";
import { Button, cx } from "../../ui";
import Sheet, { SheetFooter, FormField, Hint, fieldInputCls as inp } from "../Sheet";

export default function ChangeDiscountModal({ candidate, onClose, onSave }) {
  const promotions = getPromotions();
  const [selectedId, setSelectedId] = useState(candidate?.discountId || "none");
  const [groupCode, setGroupCode] = useState(candidate?.groupCode || candidate?.discountDetails?.groupCode || "");
  const [familyMember, setFamilyMember] = useState(candidate?.discountDetails?.familyMember || "");
  const [clubCardNumber, setClubCardNumber] = useState(candidate?.discountDetails?.clubCardNumber || "");
  const [error, setError] = useState("");

  const selectedPromo = promotions.find((p) => p.id === selectedId);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (selectedPromo?.conditionType === "group" && !groupCode.trim()) {
      setError("Upiši šifru grupe.");
      return;
    }
    if (selectedPromo?.conditionType === "family" && !familyMember.trim()) {
      setError("Upiši ime i prezime brata ili sestre.");
      return;
    }
    if (selectedPromo?.conditionType === "club_card" && !clubCardNumber.trim()) {
      setError("Upiši broj kartice.");
      return;
    }

    onSave(selectedId, {
      groupCode: groupCode.trim().toUpperCase(),
      familyMember: familyMember.trim(),
      clubCardNumber: clubCardNumber.trim(),
    });
  };

  const Option = ({ id, title, amount, meta, children }) => {
    const on = selectedId === id;
    return (
      <label
        className={cx(
          "flex cursor-pointer gap-3.5 px-4 py-4 transition-colors",
          on ? "bg-surface" : "hover:bg-surface/60"
        )}
      >
        <input type="radio" name="chosenPromo" value={id} checked={on} onChange={() => setSelectedId(id)} className="sr-only" />
        <span
          aria-hidden="true"
          className={cx(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
            on ? "border-ink bg-ink" : "border-line-strong bg-white"
          )}
        >
          {on && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-medium text-ink">{title}</span>
            <span className={cx("shrink-0 text-sm font-semibold tabular-nums", amount ? "text-emerald-700" : "text-ink-3")}>
              {amount ? `−${amount}` : "0 $"}
            </span>
          </span>
          {meta && <span className="mt-0.5 block text-[13px] text-ink-3">{meta}</span>}
          {children}
        </span>
      </label>
    );
  };

  return (
    <Sheet
      onClose={onClose}
      as="form"
      onSubmit={handleSubmit}
      title="Popust"
      subtitle="Važi samo jedan popust. Možeš da ga promeniš do konačnog obračuna."
      footer={
        <SheetFooter left={<Button variant="ghost" onClick={onClose} className="max-sm:hidden">Otkaži</Button>}>
          <Button type="submit" variant="primary">
            Sačuvaj
          </Button>
        </SheetFooter>
      }
    >
      <div className="space-y-5">
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          <Option id="none" title="Bez popusta" meta="Puna ugovorena cena" />
          {promotions.map((promo) => (
            <Option
              key={promo.id}
              id={promo.id}
              title={promo.name}
              amount={Number(promo.amount) > 0 ? promo.amountFormatted || `$${promo.amount}` : null}
              meta={[
                promo.timing === "immediate" ? "Odmah umanjuje cenu" : "Na poslednjoj rati",
                promo.conditionType === "group" ? "5+ viza i posao u grupi" : null,
                promo.conditionType === "affiliate" ? "Kad prijatelj dobije vizu i posao" : null,
                promo.code,
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              {selectedId === promo.id && (promo.description || promo.conditionText) && (
                <span className="mt-2 block text-[13px] leading-relaxed text-ink-2">
                  {promo.description}
                  {promo.conditionText && <span className="mt-1 block text-ink-3">Uslov: {promo.conditionText}</span>}
                </span>
              )}
            </Option>
          ))}
        </div>

        {selectedPromo?.conditionType === "group" && (
          <FormField label="Šifra grupe" hint="Popust od 150 $ dobijaš na kraju, ako 5+ članova grupe dobije posao i vizu.">
            <input type="text" value={groupCode} onChange={(e) => setGroupCode(e.target.value)} placeholder="BG-SUMMER-2026" className={inp} required />
          </FormField>
        )}

        {selectedPromo?.conditionType === "affiliate" && (
          <Hint>100 $ po prijatelju, na poslednjoj rati — za svakog prijatelja koji dobije vizu i posao.</Hint>
        )}

        {selectedPromo?.conditionType === "family" && (
          <FormField label="Ime i prezime brata ili sestre" hint="Važi kad se prijavite za istu sezonu.">
            <input type="text" value={familyMember} onChange={(e) => setFamilyMember(e.target.value)} placeholder="Ana Jovanović" className={inp} required />
          </FormField>
        )}

        {selectedPromo?.conditionType === "club_card" && (
          <FormField label="Broj Loyalty / Alumni kartice">
            <input type="text" value={clubCardNumber} onChange={(e) => setClubCardNumber(e.target.value)} placeholder="CC-88492" className={inp} required />
          </FormField>
        )}

        {error && <p className="text-[13px] text-red-700">{error}</p>}
      </div>
    </Sheet>
  );
}
