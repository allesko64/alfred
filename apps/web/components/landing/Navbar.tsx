"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Navbar as ResizableNavbar,
  NavBody,
  NavItems,
  MobileNav,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { AlfredLogo } from "@/components/icons/alfred-logo"

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "/docs" },
]

function Logo() {
  return (
    <a href="#" className="relative z-20 flex items-center mr-4 text-foreground">
      <AlfredLogo className="w-10 h-10" />
    </a>
  )
}

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navItems = NAV_LINKS.map((link) => ({
    name: link.label,
    link: link.href,
  }))

  return (
    <ResizableNavbar className="fixed inset-x-0 top-0 z-50">
      <NavBody>
        <Logo />
        <NavItems
          items={navItems}
          className="text-lg font-bold text-foreground/70 hover:text-foreground"
        />
        <div className="relative z-20 flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" className="text-lg font-bold" render={<Link href="/login" />} nativeButton={false}>
            Log in
          </Button>
          <Button
            variant="default"
            className="rounded-md group font-bold"
            render={<Link href="/signup" />} nativeButton={false}
          >
            Get started free
            <span className="ml-1 inline-block transition-transform duration-150 group-hover:translate-x-[3px]">
              →
            </span>
          </Button>
        </div>
      </NavBody>

      <MobileNav>
        <MobileNavHeader>
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <MobileNavToggle
              isOpen={isMenuOpen}
              onClick={() => setIsMenuOpen((open) => !open)}
            />
          </div>
        </MobileNavHeader>

        <MobileNavMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsMenuOpen(false)}
              className="relative text-lg font-semibold text-neutral-600 dark:text-neutral-300"
            >
              {link.label}
            </a>
          ))}
          <div className="flex w-full flex-col gap-4">
            <Button
              variant="ghost"
              className="text-lg font-bold justify-start px-0"
              onClick={() => setIsMenuOpen(false)}
              render={<Link href="/login" />} nativeButton={false}
            >
              Log in
            </Button>
            <Button
              variant="default"
              className="rounded-md group w-full font-bold"
              onClick={() => setIsMenuOpen(false)}
              render={<Link href="/signup" />} nativeButton={false}
            >
              Get started
              <span className="ml-1 inline-block transition-transform duration-150 group-hover:translate-x-[3px]">
                →
              </span>
            </Button>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </ResizableNavbar>
  )
}
