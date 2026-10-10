import ComingSoon from "@/components/ComingSoon";

export default function TiquetsPage() {
  return (
    <ComingSoon
      title="Tiquets"
      intro="Fes una foto del tiquet i repartiu qui paga què."
      steps={[
        "Fas la foto del tiquet en sortir del súper.",
        "L'app llegeix les línies i els preus. Pots corregir el que hagi llegit malament.",
        "A cada línia tries qui la paga: una persona, unes quantes o tots.",
        "Veus el resum del tiquet amb el que ha de pagar cadascú.",
      ]}
    />
  );
}
