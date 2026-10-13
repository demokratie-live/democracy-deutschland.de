import { MdxPage, mdxPageMetadata } from "@/components/mdx/MdxPage";

const PAGE = "contact";

export const generateMetadata = () => mdxPageMetadata(PAGE);

export default function Page() {
  return <MdxPage id={PAGE} />;
}
