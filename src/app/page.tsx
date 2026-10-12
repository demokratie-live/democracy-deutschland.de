import { MdxPage, mdxPageMetadata } from "@/components/mdx/MdxPage";

const PAGE = "home";

export const generateMetadata = () => mdxPageMetadata(PAGE);

export default function Page() {
  return <MdxPage id={PAGE} />;
}
