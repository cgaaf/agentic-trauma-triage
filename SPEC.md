Trauma Triage Agent

## Function
The agent will take input from the user of an EMS report to describe a trauma incident for a patient and determine a trauma activation level based on the provided information.

## Criteria
Currently criteria are in a csv file `trauma-criteria.csv`. It might be worth considering creating a simple database to store the criteria for easy filtering and retrieval. For example, the agent doesn't need access to the criteria specific to geriatric patients if the age of the patient is 5 years old. 

## Input
The user will be presented with a simple text input field and microphone icon to initiate the input to the agent. The agent will then process the input and provide a response.

Above the text input field there will be some helper text that instructs the user on the necessary details for a trauma report.
 - Age (Absolutely required - triage will be rejected without it)
 
 **Limited triage without these details**
 - Systolic Blood Pressure (SBP)
 - Heart Rate (HR)
 - Respiratory Rate (RR)
 - Glasgow Coma Scale (GCS)
 - Airway
 - Breathing
 - Mechanism
 - Injuries

## Output 
Once the user submits the form the agent will process the input and work on the response.

### Recognized Inputs
There should be visual feedback in realtime as details are recognized and processed. For example there should be a pane that displays the recognized details in a structured format and shows warnings for missing details. 

### activation criteria met
There should be visual feedback showing which triage criteria have been met labeled with the corresponding triage level for that criteria

### Recommended Activation Level
The recommended activation level should be displayed. The justification for that level should be displayed in a structured format.

### Some techinical considerations
Hard criteria like vital sign related criteria are often the isolated criteria that are used to determine the activation level. This might be able to be handled deterministically rather than through reasoning from an agent.
The criteria that are language based like those related to mechanism or injury status would likely use reasoning from an agent.
