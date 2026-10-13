import type { MDXRemoteProps } from "next-mdx-remote/rsc";
import { ServicesIcon, Team } from "@/components/about/Team";
import { ContactForm } from "@/components/contact/ContactForm";
import { DonateBox, DonateDetails } from "@/components/donate/DonationFigures";
import { Modal } from "@/components/donate/Modal";
import { ModalToggle } from "@/components/donate/ModalToggle";
import { AlphaBadges } from "@/components/engineering/AlphaBadges";
import { BugReportForm, VolunteerForm } from "@/components/engineering/EngineeringForms";
import { Roadmap } from "@/components/engineering/Roadmap";
import { Faq } from "@/components/faq/Faq";
import { FeatureVideos, InfoBadge } from "@/components/home/FeatureVideos";
import { LegalText } from "@/components/legal/LegalText";
import { BlogTeasers, PressMedia } from "@/components/press/PressTiles";
import { AppHeader } from "@/components/shared/AppHeader";
import { ComparisonAccordion, ComparisonRow } from "@/components/shared/ComparisonAccordion";
import { Img } from "@/components/shared/Img";
import { Link } from "@/components/shared/Link";
import { PressLogo, PressLogos } from "@/components/shared/PressLogos";
import { RectangleInfo } from "@/components/shared/RectangleInfo";
import { ScrollIcon } from "@/components/shared/ScrollIcon";
import { Section } from "@/components/shared/Section";
import { VideoSection } from "@/components/shared/VideoSection";
import { SymbolInfo, SymbolInfoPanel } from "@/components/wahlometer/SymbolInfo";
import { Campaign, CampaignCorner, WhyUs } from "@/components/wahlometer/WomAbout";

/** Everything usable in content/pages/*.mdx without import (see AGENTS.md). */
export const mdxComponents: MDXRemoteProps["components"] = {
  // Markdown links get basePath and client navigation.
  a: Link,
  Link,
  Img,
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
  DonateBox,
  DonateDetails,
  Modal,
  ModalToggle,
  Team,
  ServicesIcon,
  PressMedia,
  BlogTeasers,
  Faq,
  ContactForm,
  LegalText,
  Roadmap,
  AlphaBadges,
  BugReportForm,
  VolunteerForm,
};
