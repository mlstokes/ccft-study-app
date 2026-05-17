-- Seed: CCFT Content Outline (V3.0-20230223R1KW)
-- Source: https://assets.crossfit.com/pdfs/certifications/CCFT_ContentOutline.pdf

-- ============================================================
-- DOMAINS
-- ============================================================

insert into domains (id, code, name, exam_items, exam_weight, sort_order) values
  ('D1', '1', 'Screening and Ongoing Assessment', 11, 8, 1),
  ('D2', '2', 'Programming', 19, 14, 2),
  ('D3', '3', 'Educating', 27, 19, 3),
  ('D4', '4', 'Training', 34, 24, 4),
  ('D5', '5', 'Leadership and Management', 23, 16, 5),
  ('D6', '6', 'Lifestyle Education', 15, 11, 6),
  ('D7', '7', 'Professional Responsibilities', 11, 8, 7);

-- ============================================================
-- DOMAIN 1: Screening and Ongoing Assessment (8%)
-- ============================================================

insert into tasks (id, domain_id, code, name, sort_order) values
  ('1.1', 'D1', '1.1', 'Determine the athlete''s readiness for training', 1),
  ('1.2', 'D1', '1.2', 'Assess and monitor the athlete''s fitness goals and performance', 2);

insert into abilities (id, task_id, domain_id, code, name, sort_order) values
  ('1.1.1', '1.1', 'D1', '1.1.1', 'Screen athlete for medical issues (e.g., health questionnaire)', 1),
  ('1.1.2', '1.1', 'D1', '1.1.2', 'Recognize conditions and injuries outside of Certified CrossFit Trainer Scope of Practice that require referral (i.e., risk factors)', 2),
  ('1.1.3', '1.1', 'D1', '1.1.3', 'Assess for rhabdomyolysis ("rhabdo") risk', 3),
  ('1.1.4', '1.1', 'D1', '1.1.4', 'Assess psychological tolerance for training', 4),
  ('1.2.1', '1.2', 'D1', '1.2.1', 'Assess capacity and capability to perform functional movements', 5),
  ('1.2.2', '1.2', 'D1', '1.2.2', 'Evaluate athlete''s work capacity', 6),
  ('1.2.3', '1.2', 'D1', '1.2.3', 'Identify athlete''s fitness goals', 7),
  ('1.2.4', '1.2', 'D1', '1.2.4', 'Monitor athlete for signs of over- or under-training', 8),
  ('1.2.5', '1.2', 'D1', '1.2.5', 'Identify when athlete is ready to progress to another goal/skill', 9),
  ('1.2.6', '1.2', 'D1', '1.2.6', 'Quantify and track performance', 10);

-- ============================================================
-- DOMAIN 2: Programming (14%)
-- ============================================================

insert into tasks (id, domain_id, code, name, sort_order) values
  ('2.1', 'D2', '2.1', 'Design workouts at an individual and group level', 1),
  ('2.2', 'D2', '2.2', 'Create scaling options to optimize results for categories of athletes', 2),
  ('2.3', 'D2', '2.3', 'Evaluate results of programming', 3);

insert into abilities (id, task_id, domain_id, code, name, sort_order) values
  ('2.1.1', '2.1', 'D2', '2.1.1', 'Design single workouts using the CrossFit methodology', 1),
  ('2.1.2', '2.1', 'D2', '2.1.2', 'Design a sequence of workouts that will improve general physical preparedness (GPP)', 2),
  ('2.2.1', '2.2', 'D2', '2.2.1', 'Scale workouts to optimize efficacy by age group', 3),
  ('2.2.2', '2.2', 'D2', '2.2.2', 'Scale workouts to optimize efficacy for special populations (e.g., pregnant people, adaptive)', 4),
  ('2.2.3', '2.2', 'D2', '2.2.3', 'Scale workouts to optimize efficacy for athletes with sport-specific goals', 5),
  ('2.2.4', '2.2', 'D2', '2.2.4', 'Design programming for injured athletes to maintain fitness and restore functionality', 6),
  ('2.2.5', '2.2', 'D2', '2.2.5', 'Scale workouts to optimize efficacy by skill level', 7),
  ('2.3.1', '2.3', 'D2', '2.3.1', 'Evaluate program success relative to athlete goals and needs', 8),
  ('2.3.2', '2.3', 'D2', '2.3.2', 'Use benchmarks to assess effectiveness of programming', 9),
  ('2.3.3', '2.3', 'D2', '2.3.3', 'Adjust programming based on performance and goals', 10),
  ('2.3.4', '2.3', 'D2', '2.3.4', 'Evaluate athlete progress relative to CrossFit''s definition of fitness and their personal goal', 11);

-- ============================================================
-- DOMAIN 3: Educating (19%)
-- ============================================================

insert into tasks (id, domain_id, code, name, sort_order) values
  ('3.1', 'D3', '3.1', 'Teach movements and concepts', 1),
  ('3.2', 'D3', '3.2', 'Demonstrate movements and concepts', 2);

insert into abilities (id, task_id, domain_id, code, name, sort_order) values
  ('3.1.1', '3.1', 'D3', '3.1.1', 'Teach proper execution of movements', 1),
  ('3.1.2', '3.1', 'D3', '3.1.2', 'Layer instruction to meet athlete capability', 2),
  ('3.1.3', '3.1', 'D3', '3.1.3', 'Use progressions to teach complex moves as necessary', 3),
  ('3.1.4', '3.1', 'D3', '3.1.4', 'Teach and use correct spotting techniques', 4),
  ('3.1.5', '3.1', 'D3', '3.1.5', 'Teach the definition of CrossFit', 5),
  ('3.1.6', '3.1', 'D3', '3.1.6', 'Teach descriptive and defining characteristics of functional movements', 6),
  ('3.1.7', '3.1', 'D3', '3.1.7', 'Teach importance of movements that do not produce much, if any, power (e.g., L-sit, back lever)', 7),
  ('3.1.8', '3.1', 'D3', '3.1.8', 'Teach the CrossFit definition of fitness and health and the four models that illustrate that definition', 8),
  ('3.1.9', '3.1', 'D3', '3.1.9', 'Teach the goals of CrossFit programming and how goals are met (e.g., programming with variance)', 9),
  ('3.1.10', '3.1', 'D3', '3.1.10', 'Teach the relationship between technique and intensity (i.e., threshold training)', 10),
  ('3.1.11', '3.1', 'D3', '3.1.11', 'Teach relative intensity', 11),
  ('3.1.12', '3.1', 'D3', '3.1.12', 'Teach the principles of scaling', 12),
  ('3.2.1', '3.2', 'D3', '3.2.1', 'Provide demonstration of proper movements', 13),
  ('3.2.2', '3.2', 'D3', '3.2.2', 'Provide demonstration of movement faults', 14),
  ('3.2.3', '3.2', 'D3', '3.2.3', 'Provide demonstration of movement progressions', 15);

-- ============================================================
-- DOMAIN 4: Training (24%)
-- ============================================================

insert into tasks (id, domain_id, code, name, sort_order) values
  ('4.1', 'D4', '4.1', 'Evaluate athlete movements', 1),
  ('4.2', 'D4', '4.2', 'Facilitate correct movement', 2);

insert into abilities (id, task_id, domain_id, code, name, sort_order) values
  ('4.1.1', '4.1', 'D4', '4.1.1', 'Identify points of performance', 1),
  ('4.1.2', '4.1', 'D4', '4.1.2', 'Identify sound mechanics', 2),
  ('4.1.3', '4.1', 'D4', '4.1.3', 'Identify faults in movement', 3),
  ('4.1.4', '4.1', 'D4', '4.1.4', 'Identify refinements of sound mechanics to optimize performance', 4),
  ('4.1.5', '4.1', 'D4', '4.1.5', 'Identify common themes in athletes'' movements', 5),
  ('4.1.6', '4.1', 'D4', '4.1.6', 'Identify root cause of faults', 6),
  ('4.2.1', '4.2', 'D4', '4.2.1', 'Communicate cues to correct unsound mechanics', 7),
  ('4.2.2', '4.2', 'D4', '4.2.2', 'Use multiple cueing strategies (visual, tactile, and verbal)', 8),
  ('4.2.3', '4.2', 'D4', '4.2.3', 'Utilize effective cues (short, specific, actionable)', 9),
  ('4.2.4', '4.2', 'D4', '4.2.4', 'Reinforce sound mechanics', 10),
  ('4.2.5', '4.2', 'D4', '4.2.5', 'Refine sound mechanics to optimize performance', 11),
  ('4.2.6', '4.2', 'D4', '4.2.6', 'Apply basic principles of anatomy and biomechanics', 12),
  ('4.2.7', '4.2', 'D4', '4.2.7', 'Address the most egregious fault first (triage)', 13),
  ('4.2.8', '4.2', 'D4', '4.2.8', 'Balance relentlessness with acknowledgement of improvement', 14);

-- ============================================================
-- DOMAIN 5: Leadership and Management (16%)
-- ============================================================

insert into tasks (id, domain_id, code, name, sort_order) values
  ('5.1', 'D5', '5.1', 'Inspire, motivate, and engage athletes', 1),
  ('5.2', 'D5', '5.2', 'Manage athletes and groups', 2);

insert into abilities (id, task_id, domain_id, code, name, sort_order) values
  ('5.1.1', '5.1', 'D5', '5.1.1', 'Provide athletes with goal setting', 1),
  ('5.1.2', '5.1', 'D5', '5.1.2', 'Create a culture and community of excellence and camaraderie', 2),
  ('5.1.3', '5.1', 'D5', '5.1.3', 'Establish rapport with athletes and adapt approach based on athlete response', 3),
  ('5.1.4', '5.1', 'D5', '5.1.4', 'Lead by example', 4),
  ('5.2.1', '5.2', 'D5', '5.2.1', 'Apply the strategy of mechanics, consistency, and intensity to CrossFit programming to optimize athlete safety and performance', 5),
  ('5.2.2', '5.2', 'D5', '5.2.2', 'Apply scaling options to meet the current physical and psychological needs of each athlete', 6),
  ('5.2.3', '5.2', 'D5', '5.2.3', 'Manage risk for the athlete', 7),
  ('5.2.4', '5.2', 'D5', '5.2.4', 'Plan lessons for a class period (including general warm-up, skill development session, workout, and cool-down)', 8),
  ('5.2.5', '5.2', 'D5', '5.2.5', 'Engage virtual athletes', 9),
  ('5.2.6', '5.2', 'D5', '5.2.6', 'Recognize warning signs for possible injury or overexertion', 10),
  ('5.2.7', '5.2', 'D5', '5.2.7', 'Arrange equipment, athletes, and instructor(s) to maximize safety', 11),
  ('5.2.8', '5.2', 'D5', '5.2.8', 'Educate athletes on personal responsibility in a workout setting', 12),
  ('5.2.9', '5.2', 'D5', '5.2.9', 'Balance attention across individuals while maintaining group cohesion', 13),
  ('5.2.10', '5.2', 'D5', '5.2.10', 'Manage logistics (including instructor-to-athlete ratio, equipment demands, workout duration, and effective utilization of space)', 14),
  ('5.2.11', '5.2', 'D5', '5.2.11', 'Organize athletes, space, equipment, and time to achieve workout objectives', 15);

-- ============================================================
-- DOMAIN 6: Lifestyle Education (11%)
-- ============================================================

insert into tasks (id, domain_id, code, name, sort_order) values
  ('6.1', 'D6', '6.1', 'Provide nutrition education', 1),
  ('6.2', 'D6', '6.2', 'Provide additional lifestyle education', 2);

insert into abilities (id, task_id, domain_id, code, name, sort_order) values
  ('6.1.1', '6.1', 'D6', '6.1.1', 'Identify nutrition goals', 1),
  ('6.1.2', '6.1', 'D6', '6.1.2', 'Assess athlete''s nutrition', 2),
  ('6.1.3', '6.1', 'D6', '6.1.3', 'Provide nutrition guidance', 3),
  ('6.1.4', '6.1', 'D6', '6.1.4', 'Review basic health markers (e.g., high-density lipoprotein, triglycerides, hemoglobin A1C, body fat percentage, lean-body mass, blood pressure, and bone density)', 4),
  ('6.1.5', '6.1', 'D6', '6.1.5', 'Recognize nutrition scope of practice limitations', 5),
  ('6.1.6', '6.1', 'D6', '6.1.6', 'Outline dietary strategies (including food types and amounts)', 6),
  ('6.1.7', '6.1', 'D6', '6.1.7', 'Teach athletes how to read food labels', 7),
  ('6.1.8', '6.1', 'D6', '6.1.8', 'Teach athletes how to build sample meal plans', 8),
  ('6.2.1', '6.2', 'D6', '6.2.1', 'Identify additional lifestyle goals (e.g., alcohol or substance use, sleep/recovery, stress)', 9),
  ('6.2.2', '6.2', 'D6', '6.2.2', 'Assess athlete''s lifestyle', 10),
  ('6.2.3', '6.2', 'D6', '6.2.3', 'Provide additional lifestyle guidance', 11),
  ('6.2.4', '6.2', 'D6', '6.2.4', 'Recognize scope-of-practice limitations', 12);

-- ============================================================
-- DOMAIN 7: Professional Responsibilities (8%)
-- ============================================================

insert into tasks (id, domain_id, code, name, sort_order) values
  ('7.1', 'D7', '7.1', 'Engage in professional development', 1),
  ('7.2', 'D7', '7.2', 'Manage risk for the business entity and the facility', 2),
  ('7.3', 'D7', '7.3', 'Prepare for a medical emergency and equipment or facility malfunction', 3),
  ('7.4', 'D7', '7.4', 'Run an ethical practice', 4);

insert into abilities (id, task_id, domain_id, code, name, sort_order) values
  ('7.1.1', '7.1', 'D7', '7.1.1', 'Self-assess individual and group training sessions according to the foundations of effective training', 1),
  ('7.1.2', '7.1', 'D7', '7.1.2', 'Pursue continuing education', 2),
  ('7.2.1', '7.2', 'D7', '7.2.1', 'Obtain informed consent and waiver of liability from every athlete consistent with local regulations', 3),
  ('7.2.2', '7.2', 'D7', '7.2.2', 'Obtain written and signed medical release from athlete, when required', 4),
  ('7.2.3', '7.2', 'D7', '7.2.3', 'Maintain and inspect equipment and keep facility clean and safe', 5),
  ('7.2.4', '7.2', 'D7', '7.2.4', 'Recognize and respond to extreme environmental conditions', 6),
  ('7.2.5', '7.2', 'D7', '7.2.5', 'Assess insurance policy and other legal needs (e.g., liability, employment status, truth in advertising)', 7),
  ('7.3.1', '7.3', 'D7', '7.3.1', 'Prepare and practice response to facility emergencies, medical emergencies, and injuries (i.e., create and follow an emergency action plan or EAP)', 8),
  ('7.4.1', '7.4', 'D7', '7.4.1', 'Work within Certified CrossFit Trainer Scope of Practice', 9),
  ('7.4.2', '7.4', 'D7', '7.4.2', 'Adhere to CrossFit Standards of Professional Practice and other related legal agreements', 10);
