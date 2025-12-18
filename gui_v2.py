"""
Flashscore Bot - GUI v2
Gelismis arayuz: Terminal, Pause/Stop, Progress
"""

import customtkinter as ctk
from tkinter import messagebox, Listbox, MULTIPLE, END, Text, WORD
import json
import subprocess
import sys
import os
import threading
import queue
import re
from datetime import datetime, timedelta
from progress_tracker import read_progress, get_failed_count, get_failed_matches

# Dizin ayarlari
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def get_path(filename):
    return os.path.join(SCRIPT_DIR, filename)

def get_user_data_path(filename):
    if getattr(sys, 'frozen', False):
        base = os.path.dirname(sys.executable)
    else:
        base = SCRIPT_DIR
    return os.path.join(base, filename)

# Tema
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

COLORS = {
    "bg": "#0a0e17",
    "card": "#141c2b",
    "accent": "#00d4aa",
    "text": "#ffffff",
    "text_dim": "#8892a0",
    "success": "#22c55e",
    "warning": "#f59e0b",
    "danger": "#ef4444",
}

MAX_WORKERS = 100  # Browser limiti


class FlashscoreApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("FLASHSCORE PRO v2")
        self.geometry("1150x850")
        self.minsize(1000, 750)
        self.configure(fg_color=COLORS["bg"])
        
        # Zoom
        self.zoom = 1.0
        self.bind("<Control-plus>", lambda e: self.zoom_in())
        self.bind("<Control-minus>", lambda e: self.zoom_out())
        self.bind("<Control-equal>", lambda e: self.zoom_in())
        self.bind("<Control-0>", lambda e: self.zoom_reset())
        
        # Process kontrol
        self.current_process = None
        self.is_paused = False
        self.should_stop = False
        self.output_queue = queue.Queue()
        
        # Progress bilgileri
        self.total_matches = 0
        self.processed_matches = 0
        self.start_time = None
        
        # Data & widgets
        self.load_data()
        self.tab_widgets = {}
        
        # UI
        self.create_ui()
        
        # Output okuyucu
        self.after(100, self.check_output_queue)
        
        # Progress file okuyucu
        self.after(500, self.check_progress_file)
    
    def zoom_in(self):
        if self.zoom < 1.4:
            self.zoom += 0.1
            w, h = int(1150 * self.zoom), int(850 * self.zoom)
            self.geometry(f"{w}x{h}")
    
    def zoom_out(self):
        if self.zoom > 0.8:
            self.zoom -= 0.1
            w, h = int(1150 * self.zoom), int(850 * self.zoom)
            self.geometry(f"{w}x{h}")
    
    def zoom_reset(self):
        self.zoom = 1.0
        self.geometry("1150x850")
    
    def load_data(self):
        try:
            with open(get_path("league_list.json"), "r", encoding="utf-8") as f:
                data = json.load(f)
            self.leagues = [f"{item['country']} - {item['league']}" for item in data]
        except:
            self.leagues = ["Turkey - Super Lig", "England - Premier League"]
        
        self.bookmakers = ["bet365", "BetMGM", "Betfred", "Unibetuk", "Betway", 
                          "Midnite", "Ladbrokes", "7Bet", "Betfair", "BetUK"]
        
        self.bet_types = [
            ("1X2", "1x2"), ("O/U", "over-under"), ("AH", "asian-handicap"),
            ("BTTS", "both-teams-to-score"), ("DC", "double-chance"),
            ("DNB", "draw-no-bet"), ("HT/FT", "ht-ft"), ("CS", "correct-score"),
            ("O/E", "odd-even"), ("EH", "european-handicap")
        ]
    
    def create_ui(self):
        main = ctk.CTkFrame(self, fg_color="transparent")
        main.pack(fill="both", expand=True, padx=20, pady=15)
        
        self.create_header(main)
        self.create_search_bar(main)
        
        # ANA SEKMELER
        self.main_tabview = ctk.CTkTabview(main, fg_color=COLORS["card"])
        self.main_tabview.pack(fill="both", expand=True, pady=10)
        
        self.main_tabview.add("Sezonluk Veri")
        self.main_tabview.add("⚡ Hybrid")  # YENI - Hybrid mode
        self.main_tabview.add("Yeni Maclar")
        self.main_tabview.add("Eski Maclar")
        self.main_tabview.add("Terminal")
        
        self.create_season_tab(self.main_tabview.tab("Sezonluk Veri"))
        self.create_hybrid_tab(self.main_tabview.tab("⚡ Hybrid"))  # YENI
        self.create_future_tab(self.main_tabview.tab("Yeni Maclar"))
        self.create_old_tab(self.main_tabview.tab("Eski Maclar"))
        self.create_terminal_tab(self.main_tabview.tab("Terminal"))
        
        # FOOTER - Progress ve Kontroller
        self.create_footer(main)
    
    def create_header(self, parent):
        header = ctk.CTkFrame(parent, fg_color="transparent", height=50)
        header.pack(fill="x")
        header.pack_propagate(False)
        
        ctk.CTkLabel(header, text="FLASHSCORE PRO", 
                    font=ctk.CTkFont(size=24, weight="bold"),
                    text_color=COLORS["accent"]).pack(side="left")
        
        self.status_label = ctk.CTkLabel(header, text="Hazir", 
                                         text_color=COLORS["success"])
        self.status_label.pack(side="right")
    
    def create_search_bar(self, parent):
        frame = ctk.CTkFrame(parent, fg_color=COLORS["card"], height=40)
        frame.pack(fill="x", pady=(5, 0))
        frame.pack_propagate(False)
        
        self.search_var = ctk.StringVar()
        ctk.CTkEntry(frame, textvariable=self.search_var,
                    placeholder_text="Lig ara...",
                    fg_color=COLORS["bg"], border_width=0
                    ).pack(fill="both", expand=True, padx=10, pady=5)
        
        self.search_var.trace_add("write", self.filter_leagues)
    
    def filter_leagues(self, *args):
        query = self.search_var.get().lower()
        for tab_name, widgets in self.tab_widgets.items():
            listbox = widgets.get("lig_listbox")
            if listbox:
                listbox.delete(0, END)
                for lig in self.leagues:
                    if query in lig.lower():
                        listbox.insert(END, lig)
    
    def create_terminal_tab(self, tab):
        """Terminal sekmesi - Konsol ciktisi"""
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_rowconfigure(0, weight=1)
        
        # Terminal text widget
        terminal_frame = ctk.CTkFrame(tab, fg_color=COLORS["bg"])
        terminal_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        self.terminal_text = Text(terminal_frame, 
                                 bg="#0a0e17", fg="#00ff00",
                                 font=("Consolas", 10),
                                 wrap=WORD, 
                                 highlightthickness=0, bd=0,
                                 insertbackground="#00ff00")
        self.terminal_text.pack(fill="both", expand=True, padx=5, pady=5)
        self.terminal_text.insert(END, "=== FLASHSCORE BOT TERMINAL ===\n")
        self.terminal_text.insert(END, "Islem basladiginda ciktilar burada gorunecek.\n\n")
        self.terminal_text.config(state="disabled")
        
        # Temizle butonu
        ctk.CTkButton(tab, text="Terminali Temizle", 
                     command=self.clear_terminal,
                     fg_color="#64748b", height=30).pack(pady=5)
    
    def clear_terminal(self):
        self.terminal_text.config(state="normal")
        self.terminal_text.delete(1.0, END)
        self.terminal_text.insert(END, "=== TERMINAL TEMIZLENDI ===\n\n")
        self.terminal_text.config(state="disabled")
    
    def append_terminal(self, text):
        self.terminal_text.config(state="normal")
        self.terminal_text.insert(END, text + "\n")
        self.terminal_text.see(END)
        self.terminal_text.config(state="disabled")
    
    def create_common_left_panel(self, parent, tab_name):
        left = ctk.CTkFrame(parent, fg_color="transparent")
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 10), pady=5)
        
        ctk.CTkLabel(left, text=f"LIG SECIMI ({len(self.leagues)} lig)", 
                    font=ctk.CTkFont(weight="bold")).pack(anchor="w")
        
        lig_frame = ctk.CTkFrame(left, fg_color=COLORS["bg"])
        lig_frame.pack(fill="both", expand=True, pady=5)
        
        listbox = Listbox(lig_frame, selectmode=MULTIPLE, 
                         bg="#0a0e17", fg="white", 
                         selectbackground="#00d4aa", selectforeground="black",
                         highlightthickness=0, bd=0, font=("Segoe UI", 10))
        listbox.pack(fill="both", expand=True, padx=2, pady=2)
        
        for lig in self.leagues:
            listbox.insert(END, lig)
        
        btn_frame = ctk.CTkFrame(left, fg_color="transparent")
        btn_frame.pack(fill="x", pady=5)
        
        ctk.CTkButton(btn_frame, text="Tumunu Sec", 
                     command=lambda lb=listbox: lb.select_set(0, END),
                     fg_color=COLORS["accent"], text_color="black", height=25
                     ).pack(side="left", padx=(0,5))
        ctk.CTkButton(btn_frame, text="Temizle", 
                     command=lambda lb=listbox: lb.selection_clear(0, END),
                     fg_color="#64748b", height=25).pack(side="left")
        
        ctk.CTkLabel(left, text="BAHIS BUROLARI", 
                    font=ctk.CTkFont(weight="bold")).pack(anchor="w", pady=(10,5))
        
        bookie_frame = ctk.CTkFrame(left, fg_color=COLORS["bg"])
        bookie_frame.pack(fill="x", pady=5)
        
        bookie_vars = []
        for i, bookie in enumerate(self.bookmakers):
            var = ctk.BooleanVar(value=(bookie == "bet365"))
            cb = ctk.CTkCheckBox(bookie_frame, text=bookie, variable=var,
                                fg_color=COLORS["accent"])
            cb.grid(row=i//2, column=i%2, sticky="w", padx=5, pady=2)
            bookie_vars.append((var, bookie))
        
        # Bookie select all / clear buttons
        bookie_btn_frame = ctk.CTkFrame(left, fg_color="transparent")
        bookie_btn_frame.pack(fill="x", pady=2)
        
        def select_all_bookies():
            for var, _ in bookie_vars:
                var.set(True)
        
        def clear_all_bookies():
            for var, _ in bookie_vars:
                var.set(False)
        
        ctk.CTkButton(bookie_btn_frame, text="Tumunu Sec", 
                     command=select_all_bookies,
                     fg_color=COLORS["accent"], text_color="black", height=22, width=80
                     ).pack(side="left", padx=(0,5))
        ctk.CTkButton(bookie_btn_frame, text="Temizle", 
                     command=clear_all_bookies,
                     fg_color="#64748b", height=22, width=60).pack(side="left")
        
        return listbox, bookie_vars
    
    def create_common_right_panel(self, parent, tab_name, script_name, date_widget_creator):
        right = ctk.CTkFrame(parent, fg_color="transparent")
        right.grid(row=0, column=1, sticky="nsew", padx=(10, 0), pady=5)
        
        # Worker
        ctk.CTkLabel(right, text=f"ÇALIŞAN SAYISI (Max: {MAX_WORKERS})", 
                    font=ctk.CTkFont(weight="bold")).pack(anchor="w")
        
        worker_frame = ctk.CTkFrame(right, fg_color="transparent")
        worker_frame.pack(fill="x", pady=5)
        
        worker_var = ctk.IntVar(value=100)
        ctk.CTkSlider(worker_frame, from_=1, to=MAX_WORKERS, 
                     variable=worker_var, number_of_steps=MAX_WORKERS-1,
                     fg_color=COLORS["bg"], progress_color=COLORS["accent"]
                     ).pack(side="left", fill="x", expand=True)
        ctk.CTkLabel(worker_frame, textvariable=worker_var, width=40).pack(side="left", padx=10)
        
        # Bet types
        ctk.CTkLabel(right, text="ORAN TIPLERI", 
                    font=ctk.CTkFont(weight="bold")).pack(anchor="w", pady=(10,5))
        
        bet_frame = ctk.CTkFrame(right, fg_color=COLORS["bg"])
        bet_frame.pack(fill="x", pady=5)
        
        bet_vars = {}
        for i, (label, key) in enumerate(self.bet_types):
            var = ctk.BooleanVar(value=(key in ["1x2", "over-under"]))
            cb = ctk.CTkCheckBox(bet_frame, text=label, variable=var,
                                fg_color=COLORS["accent"], width=60)
            cb.grid(row=i//5, column=i%5, padx=3, pady=3)
            bet_vars[key] = var
        
        # Bet types select all / clear buttons
        bet_btn_frame = ctk.CTkFrame(right, fg_color="transparent")
        bet_btn_frame.pack(fill="x", pady=2)
        
        def select_all_bets():
            for var in bet_vars.values():
                var.set(True)
        
        def clear_all_bets():
            for var in bet_vars.values():
                var.set(False)
        
        ctk.CTkButton(bet_btn_frame, text="Tumunu Sec", 
                     command=select_all_bets,
                     fg_color=COLORS["accent"], text_color="black", height=22, width=80
                     ).pack(side="left", padx=(0,5))
        ctk.CTkButton(bet_btn_frame, text="Temizle", 
                     command=clear_all_bets,
                     fg_color="#64748b", height=22, width=60).pack(side="left")
        
        # Date
        date_widgets = date_widget_creator(right)
        
        # Butonlar
        btn_frame = ctk.CTkFrame(right, fg_color="transparent")
        btn_frame.pack(fill="x", pady=(15, 0))
        
        ctk.CTkButton(btn_frame, text="VERILERI GETIR", 
                     command=lambda: self.run_script(tab_name, script_name),
                     fg_color=COLORS["accent"], text_color="black",
                     font=ctk.CTkFont(weight="bold"), height=40).pack(fill="x", pady=3)
        
        btn_row = ctk.CTkFrame(btn_frame, fg_color="transparent")
        btn_row.pack(fill="x", pady=3)
        
        ctk.CTkButton(btn_row, text="ID Yenile", command=self.run_id_collect,
                     fg_color="#0891b2", height=30).pack(side="left", fill="x", expand=True, padx=(0,2))
        ctk.CTkButton(btn_row, text="Lig Guncelle", command=self.run_update_leagues,
                     fg_color="#6366f1", height=30).pack(side="left", fill="x", expand=True, padx=2)
        ctk.CTkButton(btn_row, text="Retry", command=self.run_retry,
                     fg_color=COLORS["warning"], text_color="black", height=30).pack(side="left", fill="x", expand=True, padx=2)
        
        return worker_var, bet_vars, date_widgets
    
    def create_season_tab(self, tab):
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_columnconfigure(1, weight=1)
        tab.grid_rowconfigure(0, weight=1)
        
        listbox, bookie_vars = self.create_common_left_panel(tab, "season")
        
        def create_date(parent):
            ctk.CTkLabel(parent, text="SEZON (2015-2026)", 
                        font=ctk.CTkFont(weight="bold")).pack(anchor="w", pady=(10,5))
            frame = ctk.CTkFrame(parent, fg_color="transparent")
            frame.pack(fill="x", pady=5)
            years = [str(y) for y in range(2015, 2027)]
            
            ctk.CTkLabel(frame, text="Baslangic:").pack(side="left")
            start = ctk.CTkOptionMenu(frame, values=years, width=80,
                                      fg_color=COLORS["bg"], button_color=COLORS["accent"])
            start.set("2024")
            start.pack(side="left", padx=5)
            
            ctk.CTkLabel(frame, text="Bitis:").pack(side="left", padx=(15,0))
            end = ctk.CTkOptionMenu(frame, values=years, width=80,
                                    fg_color=COLORS["bg"], button_color=COLORS["accent"])
            end.set("2025")
            end.pack(side="left", padx=5)
            return {"start": start, "end": end}
        
        worker_var, bet_vars, date_widgets = self.create_common_right_panel(
            tab, "season", "season_main.py", create_date)
        
        self.tab_widgets["season"] = {
            "lig_listbox": listbox, "bookie_vars": bookie_vars,
            "worker_var": worker_var, "bet_vars": bet_vars, "date_widgets": date_widgets
        }
    
    def create_hybrid_tab(self, tab):
        """Hybrid mode: HTTP + Playwright (SAAT ve İY için doğru veri)"""
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_columnconfigure(1, weight=1)
        tab.grid_rowconfigure(0, weight=1)
        
        listbox, bookie_vars = self.create_common_left_panel(tab, "hybrid")
        
        def create_date(parent):
            # Info label
            ctk.CTkLabel(parent, text="⚡ HYBRID MOD", 
                        font=ctk.CTkFont(weight="bold", size=14),
                        text_color=COLORS["accent"]).pack(anchor="w", pady=(10,5))
            
            ctk.CTkLabel(parent, text="HTTP ile hızlı oran çekimi\nPlaywright ile doğru SAAT/İY", 
                        font=ctk.CTkFont(size=11),
                        text_color=COLORS["text_dim"]).pack(anchor="w", pady=(0,10))
            
            ctk.CTkLabel(parent, text="SEZON (2015-2026)", 
                        font=ctk.CTkFont(weight="bold")).pack(anchor="w", pady=(10,5))
            frame = ctk.CTkFrame(parent, fg_color="transparent")
            frame.pack(fill="x", pady=5)
            years = [str(y) for y in range(2015, 2027)]
            
            ctk.CTkLabel(frame, text="Baslangic:").pack(side="left")
            start = ctk.CTkOptionMenu(frame, values=years, width=80,
                                      fg_color=COLORS["bg"], button_color=COLORS["accent"])
            start.set("2024")
            start.pack(side="left", padx=5)
            
            ctk.CTkLabel(frame, text="Bitis:").pack(side="left", padx=(15,0))
            end = ctk.CTkOptionMenu(frame, values=years, width=80,
                                    fg_color=COLORS["bg"], button_color=COLORS["accent"])
            end.set("2025")
            end.pack(side="left", padx=5)
            return {"start": start, "end": end}
        
        worker_var, bet_vars, date_widgets = self.create_common_right_panel(
            tab, "hybrid", "hybrid_main.py", create_date)
        
        self.tab_widgets["hybrid"] = {
            "lig_listbox": listbox, "bookie_vars": bookie_vars,
            "worker_var": worker_var, "bet_vars": bet_vars, "date_widgets": date_widgets
        }
    
    def create_future_tab(self, tab):
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_columnconfigure(1, weight=1)
        tab.grid_rowconfigure(0, weight=1)
        
        listbox, bookie_vars = self.create_common_left_panel(tab, "future")
        
        def create_date(parent):
            today = datetime.now()
            future = today + timedelta(days=7)
            
            ctk.CTkLabel(parent, text="TARIH (+7 gun otomatik)", 
                        font=ctk.CTkFont(weight="bold")).pack(anchor="w", pady=(10,5))
            frame = ctk.CTkFrame(parent, fg_color="transparent")
            frame.pack(fill="x", pady=5)
            
            ctk.CTkLabel(frame, text="Baslangic:").pack(side="left")
            start = ctk.CTkEntry(frame, width=90)
            start.insert(0, today.strftime("%d.%m.%Y"))
            start.pack(side="left", padx=5)
            
            ctk.CTkLabel(frame, text="Bitis:").pack(side="left", padx=(15,0))
            end = ctk.CTkEntry(frame, width=90)
            end.insert(0, future.strftime("%d.%m.%Y"))
            end.pack(side="left", padx=5)
            return {"start": start, "end": end}
        
        worker_var, bet_vars, date_widgets = self.create_common_right_panel(
            tab, "future", "future_main.py", create_date)
        
        self.tab_widgets["future"] = {
            "lig_listbox": listbox, "bookie_vars": bookie_vars,
            "worker_var": worker_var, "bet_vars": bet_vars, "date_widgets": date_widgets
        }
    
    def create_old_tab(self, tab):
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_columnconfigure(1, weight=1)
        tab.grid_rowconfigure(0, weight=1)
        
        listbox, bookie_vars = self.create_common_left_panel(tab, "old")
        
        def create_date(parent):
            today = datetime.now()
            past = today - timedelta(days=7)
            
            ctk.CTkLabel(parent, text="TARIH (-7 gun otomatik)", 
                        font=ctk.CTkFont(weight="bold")).pack(anchor="w", pady=(10,5))
            frame = ctk.CTkFrame(parent, fg_color="transparent")
            frame.pack(fill="x", pady=5)
            
            ctk.CTkLabel(frame, text="Baslangic:").pack(side="left")
            start = ctk.CTkEntry(frame, width=90)
            start.insert(0, past.strftime("%d.%m.%Y"))
            start.pack(side="left", padx=5)
            
            ctk.CTkLabel(frame, text="Bitis:").pack(side="left", padx=(15,0))
            end = ctk.CTkEntry(frame, width=90)
            end.insert(0, today.strftime("%d.%m.%Y"))
            end.pack(side="left", padx=5)
            return {"start": start, "end": end}
        
        worker_var, bet_vars, date_widgets = self.create_common_right_panel(
            tab, "old", "old_main.py", create_date)
        
        self.tab_widgets["old"] = {
            "lig_listbox": listbox, "bookie_vars": bookie_vars,
            "worker_var": worker_var, "bet_vars": bet_vars, "date_widgets": date_widgets
        }
    
    def create_footer(self, parent):
        footer = ctk.CTkFrame(parent, fg_color=COLORS["card"], corner_radius=10)
        footer.pack(fill="x", pady=(10, 0))
        
        # Ust satir: Progress bar ve bilgi
        progress_row = ctk.CTkFrame(footer, fg_color="transparent")
        progress_row.pack(fill="x", padx=15, pady=(10, 5))
        
        # Progress info
        self.progress_info = ctk.CTkLabel(progress_row, text="Bekleniyor...", 
                                         text_color=COLORS["text_dim"])
        self.progress_info.pack(side="left")
        
        # ETA
        self.eta_label = ctk.CTkLabel(progress_row, text="", 
                                     text_color=COLORS["text_dim"])
        self.eta_label.pack(side="right")
        
        # Yuzde
        self.percent_label = ctk.CTkLabel(progress_row, text="0%", 
                                         font=ctk.CTkFont(weight="bold"),
                                         text_color=COLORS["accent"])
        self.percent_label.pack(side="right", padx=20)
        
        # Progress bar
        self.progress = ctk.CTkProgressBar(footer, height=20,
                                          fg_color=COLORS["bg"], 
                                          progress_color=COLORS["accent"])
        self.progress.set(0)
        self.progress.pack(fill="x", padx=15, pady=5)
        
        # Kontrol butonlari
        control_row = ctk.CTkFrame(footer, fg_color="transparent")
        control_row.pack(fill="x", padx=15, pady=(5, 10))
        
        # Duraklat butonu (sari)
        self.pause_btn = ctk.CTkButton(control_row, text="DURAKLAT", 
                                       command=self.toggle_pause,
                                       fg_color=COLORS["warning"], text_color="black",
                                       width=120, height=35)
        self.pause_btn.pack(side="left", padx=(0, 10))
        
        # Durdur butonu (kirmizi)
        self.stop_btn = ctk.CTkButton(control_row, text="DURDUR", 
                                      command=self.stop_process,
                                      fg_color=COLORS["danger"], text_color="white",
                                      width=120, height=35)
        self.stop_btn.pack(side="left", padx=(0, 10))
        
        # Secimleri Temizle butonu
        self.clear_btn = ctk.CTkButton(control_row, text="SECIMLERI TEMIZLE", 
                                       command=self.clear_all_selections,
                                       fg_color="#64748b", text_color="white",
                                       width=150, height=35)
        self.clear_btn.pack(side="left")
        
        # Version
        ctk.CTkLabel(control_row, text="v2.0 | CTRL+/- Zoom", 
                    text_color=COLORS["text_dim"]).pack(side="right")
        
        # ===== ANALİZ SATIRI =====
        analysis_row = ctk.CTkFrame(footer, fg_color=COLORS["bg"], corner_radius=8)
        analysis_row.pack(fill="x", padx=15, pady=(5, 10))
        
        # Takım 1 dropdown
        ctk.CTkLabel(analysis_row, text="Takım 1:", font=("Roboto", 12),
                    text_color=COLORS["text_dim"]).pack(side="left", padx=(10, 5))
        self.team1_var = ctk.StringVar(value="")
        self.team1_combo = ctk.CTkComboBox(analysis_row, values=["Önce tarama yapın..."], 
                                           variable=self.team1_var, width=180, state="disabled")
        self.team1_combo.pack(side="left", padx=5)
        
        # Takım 2 dropdown
        ctk.CTkLabel(analysis_row, text="Takım 2:", font=("Roboto", 12),
                    text_color=COLORS["text_dim"]).pack(side="left", padx=(15, 5))
        self.team2_var = ctk.StringVar(value="")
        self.team2_combo = ctk.CTkComboBox(analysis_row, values=["Önce tarama yapın..."], 
                                           variable=self.team2_var, width=180, state="disabled")
        self.team2_combo.pack(side="left", padx=5)
        
        # Tek Takım Analizi butonu (mavi)
        self.single_team_btn = ctk.CTkButton(analysis_row, text="📋 TEK TAKIM", 
                                              command=self.do_single_team_analysis,
                                              fg_color="#3b82f6", hover_color="#2563eb",
                                              text_color="white", width=130, height=32,
                                              state="disabled")
        self.single_team_btn.pack(side="left", padx=(15, 5))
        
        # Karşılaştır butonu (yeşil)
        self.compare_btn = ctk.CTkButton(analysis_row, text="⚔️ KARŞILAŞTIR", 
                                          command=self.do_compare_teams,
                                          fg_color=COLORS["accent"], hover_color="#00b894",
                                          text_color="white", width=130, height=32,
                                          state="disabled")
        self.compare_btn.pack(side="left", padx=5)
        
        # Store results reference
        self.analysis_results = []
    
    
    def toggle_pause(self):
        """Islemi duraklat/devam ettir"""
        if self.current_process:
            self.is_paused = not self.is_paused
            if self.is_paused:
                self.pause_btn.configure(text="DEVAM ET", fg_color=COLORS["success"])
                self.status_label.configure(text="Duraklatildi", text_color=COLORS["warning"])
                self.append_terminal("[SISTEM] Islem duraklatildi...")
            else:
                self.pause_btn.configure(text="DURAKLAT", fg_color=COLORS["warning"])
                self.status_label.configure(text="Devam ediyor...", text_color=COLORS["accent"])
                self.append_terminal("[SISTEM] Islem devam ediyor...")
    
    def stop_process(self):
        """Islemi durdur"""
        if self.current_process:
            self.should_stop = True
            try:
                self.current_process.terminate()
                self.append_terminal("[SISTEM] Islem durduruldu!")
            except:
                pass
            self.reset_progress()
            self.status_label.configure(text="Durduruldu", text_color=COLORS["danger"])
    
    def reset_progress(self):
        """Progress sifirla"""
        self.progress.set(0)
        self.progress_info.configure(text="Bekleniyor...")
        self.percent_label.configure(text="0%")
        self.eta_label.configure(text="")
        self.pause_btn.configure(text="DURAKLAT", fg_color=COLORS["warning"])
        self.is_paused = False
        self.should_stop = False
        self.current_process = None
    
    def clear_all_selections(self):
        """Tum secimleri temizle"""
        for tab_name, widgets in self.tab_widgets.items():
            # Lig secimlerini temizle
            listbox = widgets.get("lig_listbox")
            if listbox:
                listbox.selection_clear(0, END)
            
            # Bookmaker secimlerini temizle
            bookie_vars = widgets.get("bookie_vars", [])
            for var, _ in bookie_vars:
                var.set(False)
            
            # Bet type secimlerini temizle
            bet_vars = widgets.get("bet_vars", {})
            for key, var in bet_vars.items():
                var.set(False)
            
            # Worker sayisini varsayilana dondur
            worker_var = widgets.get("worker_var")
            if worker_var:
                worker_var.set(100)
        
        # Progress sifirla
        self.reset_progress()
        
        # Terminal temizle
        self.clear_terminal()
        
        # Status guncelle
        self.status_label.configure(text="Secimler temizlendi", text_color=COLORS["text_dim"])
        self.append_terminal("[SISTEM] Tum secimler temizlendi.")
    
    def check_output_queue(self):
        """Output kuyrugundan oku ve terminale yaz"""
        try:
            while True:
                line = self.output_queue.get_nowait()
                self.append_terminal(line)
                self.parse_progress(line)
        except queue.Empty:
            pass
        self.after(100, self.check_output_queue)
    
    def parse_progress(self, line):
        """Ciktiyi parse ederek progress guncelle"""
        # Match ID toplama
        if "Total matches found:" in line or "mac ID'si bulundu" in line:
            match = re.search(r'(\d+)', line)
            if match:
                self.total_matches = int(match.group(1))
                self.progress_info.configure(text=f"Toplam {self.total_matches} mac bulundu")
        
        # Match isleme
        if "Processing match" in line or "Successfully wrote" in line:
            self.processed_matches += 1
            if self.total_matches > 0:
                pct = self.processed_matches / self.total_matches
                self.progress.set(pct)
                self.percent_label.configure(text=f"{int(pct * 100)}%")
                
                remaining = self.total_matches - self.processed_matches
                self.progress_info.configure(text=f"Islenen: {self.processed_matches}/{self.total_matches}")
                
                # ETA hesapla
                if self.start_time and self.processed_matches > 0:
                    elapsed = (datetime.now() - self.start_time).total_seconds()
                    per_match = elapsed / self.processed_matches
                    eta_seconds = remaining * per_match
                    if eta_seconds > 60:
                        self.eta_label.configure(text=f"Kalan: ~{int(eta_seconds/60)} dk")
                    else:
                        self.eta_label.configure(text=f"Kalan: ~{int(eta_seconds)} sn")
    
    def check_progress_file(self):
        """Read progress.json and update UI in real-time"""
        try:
            data = read_progress()
            if data and data.get("status") == "running":
                total = data.get("total", 0)
                processed = data.get("processed", 0)
                success = data.get("success", 0)
                failed = data.get("failed", 0)
                current = data.get("current_match", "")
                status = data.get("status", "")
                retry_round = data.get("retry_round", 0)
                
                if total > 0:
                    pct = processed / total
                    self.progress.set(pct)
                    self.percent_label.configure(text=f"{int(pct * 100)}%")
                    
                    # Show detailed info with error count
                    info_text = f"OK:{success} | HATA:{failed} | {current[:30]}"
                    self.progress_info.configure(text=info_text)
                    
                    # Calculate ETA
                    if processed > 0:
                        remaining = total - processed
                        try:
                            start_str = data.get("start_time", "")
                            if start_str:
                                start = datetime.fromisoformat(start_str)
                                elapsed = (datetime.now() - start).total_seconds()
                                per_match = elapsed / processed
                                eta_seconds = remaining * per_match
                                
                                if eta_seconds > 60:
                                    self.eta_label.configure(text=f"Kalan: ~{int(eta_seconds/60)} dk")
                                else:
                                    self.eta_label.configure(text=f"Kalan: ~{int(eta_seconds)} sn")
                        except:
                            pass
                    
                    # Update status if doing retry
                    if retry_round > 0:
                        self.status_label.configure(text=f"Retry {retry_round}...", text_color=COLORS["warning"])
                
            elif data and data.get("status") == "completed":
                self.progress.set(1.0)
                self.percent_label.configure(text="100%")
                failed = get_failed_count()
                if failed > 0:
                    self.progress_info.configure(text=f"Tamamlandi! ({failed} hata)")
                else:
                    self.progress_info.configure(text="Tamamlandi!")
        except:
            pass
        
        # Keep polling
        self.after(500, self.check_progress_file)
    
    def save_config(self, tab_name):
        widgets = self.tab_widgets.get(tab_name)
        if not widgets:
            return None
        
        listbox = widgets["lig_listbox"]
        selected = [listbox.get(i) for i in listbox.curselection()]
        bookies = [b for var, b in widgets["bookie_vars"] if var.get()]
        bets = {k: v.get() for k, v in widgets["bet_vars"].items()}
        
        date_w = widgets["date_widgets"]
        start_val = date_w["start"].get()
        end_val = date_w["end"].get()
        
        config = {
            "ligler": selected,
            "bookmakers": bookies,
            "baslangic": start_val,
            "bitis": end_val,
            "bet_types": bets,
            "num_workers": widgets["worker_var"].get()
        }
        
        with open(get_user_data_path("config.json"), "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
        
        return config
    
    def run_script(self, tab_name, script_name):
        config = self.save_config(tab_name)
        
        if not config:
            messagebox.showerror("Hata", "Konfigurasyon hatasi!")
            return
        if not config["ligler"]:
            messagebox.showwarning("Uyari", "En az bir lig secin!")
            return
        if not config["bookmakers"]:
            messagebox.showwarning("Uyari", "En az bir bahis burosu secin!")
            return
        
        # Reset
        self.reset_progress()
        self.total_matches = 0
        self.processed_matches = 0
        self.start_time = datetime.now()
        
        self.status_label.configure(text=f"Calisiyor... ({config['num_workers']} worker)", 
                                   text_color=COLORS["warning"])
        self.progress_info.configure(text="Baslatiliyor...")
        self.append_terminal(f"\n{'='*50}")
        self.append_terminal(f"[BASLADI] {script_name} - {datetime.now().strftime('%H:%M:%S')}")
        self.append_terminal(f"Ligler: {len(config['ligler'])}, Workers: {config['num_workers']}")
        
        # Terminal sekmesine gec
        self.main_tabview.set("Terminal")
        
        def run():
            try:
                # NO CONSOLE FLAG
                startupinfo = None
                if sys.platform == 'win32':
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    startupinfo.wShowWindow = subprocess.SW_HIDE
                
                self.current_process = subprocess.Popen(
                    [sys.executable, get_path(script_name)],
                    cwd=SCRIPT_DIR,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    startupinfo=startupinfo,
                    bufsize=1
                )
                
                for line in iter(self.current_process.stdout.readline, ''):
                    if self.should_stop:
                        break
                    while self.is_paused and not self.should_stop:
                        import time
                        time.sleep(0.5)
                    if line.strip():
                        self.output_queue.put(line.strip())
                
                self.current_process.wait()
                
                if not self.should_stop:
                    if self.current_process.returncode == 0:
                        self.status_label.configure(text="Tamamlandi!", text_color=COLORS["success"])
                        self.progress.set(1)
                        self.percent_label.configure(text="100%")
                        self.append_terminal(f"[TAMAMLANDI] {datetime.now().strftime('%H:%M:%S')}")
                        # Enable analysis buttons and populate dropdowns
                        self.after(500, self.enable_analysis_buttons)
                    else:
                        self.status_label.configure(text="Hata!", text_color=COLORS["danger"])
                        self.append_terminal(f"[HATA] Return code: {self.current_process.returncode}")
                
                self.current_process = None
                
            except Exception as e:
                self.append_terminal(f"[HATA] {str(e)}")
                self.status_label.configure(text="Hata!", text_color=COLORS["danger"])
        
        threading.Thread(target=run, daemon=True).start()
    
    def run_id_collect(self):
        subprocess.Popen([sys.executable, get_path("get_match_ids.py")], cwd=SCRIPT_DIR,
                        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
        self.append_terminal("[BASLADI] ID toplama...")
    
    def run_update_leagues(self):
        subprocess.Popen([sys.executable, get_path("update_league_list.py")], cwd=SCRIPT_DIR,
                        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
        self.append_terminal("[BASLADI] Lig guncelleme...")
    
    def run_retry(self):
        subprocess.Popen([sys.executable, get_path("retry_failed_matches.py")], cwd=SCRIPT_DIR,
                        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
        self.append_terminal("[BASLADI] Retry...")
    
    def show_completion_popup(self):
        """Show completion popup with Analiz Çıkart option"""
        popup = ctk.CTkToplevel(self)
        popup.title("✅ İşlem Tamamlandı")
        popup.geometry("400x200")
        popup.resizable(False, False)
        popup.transient(self)
        popup.grab_set()
        
        # Center popup
        popup.update_idletasks()
        x = (popup.winfo_screenwidth() - 400) // 2
        y = (popup.winfo_screenheight() - 200) // 2
        popup.geometry(f"400x200+{x}+{y}")
        
        # Content
        ctk.CTkLabel(popup, text="✅ İşlem Tamamlandı!", font=("Roboto", 20, "bold"),
                    text_color=COLORS["success"]).pack(pady=20)
        
        ctk.CTkLabel(popup, text="Veriler başarıyla Excel'e aktarıldı.\nTakım analizi yapmak ister misiniz?",
                    font=("Roboto", 14), text_color=COLORS["text_dim"]).pack(pady=10)
        
        # Buttons
        btn_frame = ctk.CTkFrame(popup, fg_color="transparent")
        btn_frame.pack(pady=20)
        
        def open_analysis():
            popup.destroy()
            self.open_analysis_window()
        
        ctk.CTkButton(btn_frame, text="📊 Analiz Çıkart", width=140, height=40,
                     fg_color=COLORS["accent"], hover_color="#00b894",
                     command=open_analysis).pack(side="left", padx=10)
        
        ctk.CTkButton(btn_frame, text="Tamam", width=100, height=40,
                     fg_color=COLORS["card"], hover_color="#1e293b",
                     command=popup.destroy).pack(side="left", padx=10)
    
    def open_analysis_window(self):
        """Open team analysis window - bigger and centered"""
        import json
        from team_analysis import get_unique_teams, filter_h2h_matches, calculate_h2h_stats, format_h2h_report, get_team_last_matches, format_team_report
        
        # Load results from JSON
        results_file = get_user_data_path("last_results.json")
        try:
            with open(results_file, 'r', encoding='utf-8') as f:
                results = json.load(f)
        except:
            messagebox.showerror("Hata", "Analiz dosyası bulunamadı!")
            return
        
        if not results:
            messagebox.showwarning("Uyarı", "Analiz için veri bulunamadı!")
            return
        
        # Get unique teams
        teams = [""] + get_unique_teams(results)  # Add empty option for single team analysis
        
        # Create analysis window - BIGGER and CENTERED
        analysis_win = ctk.CTkToplevel(self)
        analysis_win.title("🔍 Takım Analizi")
        
        # Calculate center position
        win_width, win_height = 900, 700
        screen_width = analysis_win.winfo_screenwidth()
        screen_height = analysis_win.winfo_screenheight()
        x = (screen_width - win_width) // 2
        y = (screen_height - win_height) // 2
        analysis_win.geometry(f"{win_width}x{win_height}+{x}+{y}")
        analysis_win.resizable(False, False)
        analysis_win.grab_set()  # Make modal
        
        # Header
        ctk.CTkLabel(analysis_win, text="🔍 TAKIM ANALİZİ", font=("Roboto", 24, "bold"),
                    text_color=COLORS["accent"]).pack(pady=15)
        
        # Team selection frame
        select_frame = ctk.CTkFrame(analysis_win, fg_color=COLORS["card"])
        select_frame.pack(fill="x", padx=30, pady=15)
        
        # Row 1: Team 1
        row1 = ctk.CTkFrame(select_frame, fg_color="transparent")
        row1.pack(fill="x", pady=10, padx=15)
        ctk.CTkLabel(row1, text="Takım 1:", font=("Roboto", 14), width=80).pack(side="left")
        team1_var = ctk.StringVar(value=teams[1] if len(teams) > 1 else "")
        team1_combo = ctk.CTkComboBox(row1, values=teams, variable=team1_var, width=350)
        team1_combo.pack(side="left", padx=10)
        
        # Row 2: Team 2 (optional)
        row2 = ctk.CTkFrame(select_frame, fg_color="transparent")
        row2.pack(fill="x", pady=10, padx=15)
        ctk.CTkLabel(row2, text="Takım 2:", font=("Roboto", 14), width=80).pack(side="left")
        team2_var = ctk.StringVar(value="")
        team2_combo = ctk.CTkComboBox(row2, values=teams, variable=team2_var, width=350)
        team2_combo.pack(side="left", padx=10)
        ctk.CTkLabel(row2, text="(Boş bırakırsan tek takım analizi)", font=("Roboto", 11),
                    text_color=COLORS["text_dim"]).pack(side="left", padx=10)
        
        # Buttons frame
        btn_frame = ctk.CTkFrame(analysis_win, fg_color="transparent")
        btn_frame.pack(pady=15)
        
        # Results text area
        result_text = ctk.CTkTextbox(analysis_win, font=("Consolas", 13), fg_color=COLORS["card"],
                                     text_color=COLORS["text"])
        result_text.pack(fill="both", expand=True, padx=30, pady=10)
        result_text.insert("1.0", "👆 Takım seçin ve analiz butonuna tıklayın\n\n• Tek takım: Sadece Takım 1 seçin, son 10 maçını gösterir\n• İkili analiz: Takım 1 ve 2 seçin, head-to-head istatistik gösterir")
        
        def do_h2h_analysis():
            t1 = team1_var.get()
            t2 = team2_var.get()
            
            if not t1:
                messagebox.showwarning("Uyarı", "Lütfen en az bir takım seçin!")
                return
            
            if t2 and t1 == t2:
                messagebox.showwarning("Uyarı", "Farklı takımlar seçin!")
                return
            
            if t2:
                # H2H Analysis
                h2h_matches = filter_h2h_matches(results, t1, t2)
                stats = calculate_h2h_stats(h2h_matches, t1, t2)
                report = format_h2h_report(stats)
            else:
                # Single team analysis
                matches = get_team_last_matches(results, t1, limit=10)
                report = format_team_report(matches, t1)
            
            result_text.delete("1.0", "end")
            result_text.insert("1.0", report)
        
        ctk.CTkButton(btn_frame, text="📊 ANALİZ YAP", width=200, height=45,
                     font=("Roboto", 16, "bold"), fg_color=COLORS["accent"],
                     hover_color="#00b894", command=do_h2h_analysis).pack(side="left", padx=10)
        
        ctk.CTkButton(btn_frame, text="❌ Kapat", width=120, height=45,
                     fg_color=COLORS["danger"], hover_color="#dc2626",
                     command=analysis_win.destroy).pack(side="left", padx=10)
    
    def enable_analysis_buttons(self):
        """Enable analysis buttons and populate dropdowns after scraping completes"""
        import json
        from team_analysis import get_unique_teams
        
        # Load results from JSON
        results_file = get_user_data_path("last_results.json")
        try:
            with open(results_file, 'r', encoding='utf-8') as f:
                self.analysis_results = json.load(f)
        except:
            messagebox.showinfo("Tamamlandı", "İşlem tamamlandı!\nAnaliz için veri bulunamadı.")
            return
        
        if not self.analysis_results:
            messagebox.showinfo("Tamamlandı", "İşlem tamamlandı!")
            return
        
        # Get unique teams
        teams = get_unique_teams(self.analysis_results)
        
        if teams:
            # Update dropdowns
            self.team1_combo.configure(values=teams, state="normal")
            self.team2_combo.configure(values=teams, state="normal")
            self.team1_var.set(teams[0] if teams else "")
            self.team2_var.set(teams[1] if len(teams) > 1 else "")
            
            # Enable buttons
            self.single_team_btn.configure(state="normal")
            self.compare_btn.configure(state="normal")
            
            messagebox.showinfo("✅ Tamamlandı", 
                f"İşlem tamamlandı!\n\n{len(self.analysis_results)} maç analiz için hazır.\n\nAşağıdaki dropdown'lardan takım seçip analiz yapabilirsiniz.")
        else:
            messagebox.showinfo("Tamamlandı", "İşlem tamamlandı!")
    
    def do_single_team_analysis(self):
        """Single team analysis - show last 10 matches"""
        from team_analysis import get_team_last_matches, format_team_report
        
        team = self.team1_var.get()
        if not team:
            messagebox.showwarning("Uyarı", "Lütfen Takım 1 seçin!")
            return
        
        # Clear terminal and show results
        self.clear_terminal()
        matches = get_team_last_matches(self.analysis_results, team, limit=10)
        report = format_team_report(matches, team)
        self.append_terminal(report)
        
        # Switch to terminal tab
        self.tabview.set("Terminal")
    
    def do_compare_teams(self):
        """Compare two teams - H2H analysis"""
        from team_analysis import filter_h2h_matches, calculate_h2h_stats, format_h2h_report
        
        team1 = self.team1_var.get()
        team2 = self.team2_var.get()
        
        if not team1 or not team2:
            messagebox.showwarning("Uyarı", "Lütfen her iki takımı da seçin!")
            return
        
        if team1 == team2:
            messagebox.showwarning("Uyarı", "Farklı takımlar seçin!")
            return
        
        # Clear terminal and show results
        self.clear_terminal()
        h2h_matches = filter_h2h_matches(self.analysis_results, team1, team2)
        stats = calculate_h2h_stats(h2h_matches, team1, team2)
        report = format_h2h_report(stats)
        self.append_terminal(report)
        
        # Switch to terminal tab
        self.tabview.set("Terminal")


if __name__ == "__main__":
    app = FlashscoreApp()
    app.mainloop()
