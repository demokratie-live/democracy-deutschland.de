import type { MDXRemoteProps } from "next-mdx-remote/rsc";
import { FeatureVideos, InfoBadge } from "@/components/home/FeatureVideos";
import { AppHeader } from "@/components/shared/AppHeader";
import { Link } from "@/components/shared/Link";
import { PressLogo, PressLogos } from "@/components/shared/PressLogos";
import { RectangleInfo } from "@/components/shared/RectangleInfo";
import { ScrollIcon } from "@/components/shared/ScrollIcon";
import { Section } from "@/components/shared/Section";
import { VideoSection } from "@/components/shared/VideoSection";
import { ComparisonAccordion, ComparisonRow } from "@/components/wahlometer/ComparisonAccordion";
import { SymbolInfo, SymbolInfoPanel } from "@/components/wahlometer/SymbolInfo";
import { Campaign, CampaignCorner, WhyUs } from "@/components/wahlometer/WomAbout";

/** Everything usable in content/pages/*.mdx without import (see AGENTS.md). */
export const mdxComponents: MDXRemoteProps["components"] = {
  // Markdown links get basePath and client navigation.
  a: Link,
  Link,
  Section,
  AppHeader,
  ScrollIcon,
  VideoSection,
  PressLogos,
  PressLogo,
  RectangleInfo,
  FeatureVideos,
  InfoBadge,
  SymbolInfoPanel,
  SymbolInfo,
  ComparisonAccordion,
  ComparisonRow,
  WhyUs,
  Campaign,
  CampaignCorner,
};
