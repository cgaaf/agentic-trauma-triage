export interface ExampleReport {
	label: string;
	description: string;
	text: string;
}

export const exampleReports: ExampleReport[] = [
	{
		label: "Level 1 MVC",
		description:
			"High-speed MVC with complete vitals — expect full Level 1 trauma activation",
		text: `34-year-old male, high-speed MVC with rollover on I-85. Patient was unrestrained driver, found approximately 15 feet from vehicle.

Vitals on scene: BP 88/62, HR 125, RR 28, GCS 12 (E3V4M5). SpO2 92% on 15L NRB.

Airway maintained with jaw thrust. Decreased breath sounds on left with paradoxical chest wall movement consistent with flail segment. Left femur angulated and shortened. Large scalp laceration with active bleeding controlled with pressure dressing.

IV access x2 established, 500mL NS bolus initiated. C-collar applied, boarded. ETA 8 minutes.`,
	},
	{
		label: "Missing vitals",
		description:
			"Geriatric fall with missing RR, GCS, and breathing — shows missing data warnings",
		text: `78-year-old female, unwitnessed fall at home. Family found patient on kitchen floor, unsure how long she was down. Patient is on warfarin for atrial fibrillation.

Vitals on scene: BP 138/82, HR 92. SpO2 96% on RA.

Right hip pain with external rotation and shortening. Small hematoma noted to right parietal region. Patient alert and conversational but cannot recall the fall. No other injuries identified.

IV access established. C-collar applied. ETA 10 minutes.`,
	},
	{
		label: "Standard triage",
		description:
			"Minor fall with normal vitals — expect no trauma activation",
		text: `28-year-old male, tripped on curb while walking and fell onto outstretched right hand. No LOC, ambulatory on scene.

Vitals: BP 122/78, HR 82, RR 16, GCS 15. SpO2 99% on RA.

3 cm laceration to right volar forearm, controlled with direct pressure. No neurovascular deficit. No other injuries identified. Patient ambulating without difficulty.

Wound dressed. ETA 15 minutes to ED, non-emergent transport.`,
	},
];
