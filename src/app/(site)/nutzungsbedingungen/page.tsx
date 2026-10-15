import { MdxPage, mdxPageMetadata } from "@/components/mdx/MdxPage";

const PAGE = "nutzungsbedingungen";

export const generateMetadata = () => mdxPageMetadata(PAGE);

export default function Page() {
  return <MdxPage id={PAGE} />;
}
