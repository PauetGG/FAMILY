import ComingSoon from "@/components/ComingSoon";

export default function CompraPage() {
  return (
    <ComingSoon
      title="Compra"
      intro="La llista surt sola dels plats que tens al calendari."
      steps={[
        "Tries els dies, per exemple de dilluns a diumenge.",
        "L'app suma els ingredients de tots els plats d'aquells dies.",
        "Si la llista és del grup, ajunta la de tothom i marca per a qui és cada cosa.",
        "Al súper, vas marcant el que ja tens al carro.",
      ]}
    />
  );
}
