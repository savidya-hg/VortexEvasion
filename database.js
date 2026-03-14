const _supabase = supabase.createClient('https://dqbtnmkiiwldlvrpaupj.supabase.co', 'sb_publishable_rMEMOFO_vVHyYdpjJQSqxg_djkgWVVT');
let currentUser = localStorage.getItem('vortex_user');
let userHighScore = 0;

const AuthManager = {
    async init() {
        if(currentUser) {
            const { data } = await _supabase.from('leaderboards').select('high_score').eq('username', currentUser).maybeSingle();
            if(data) {
                userHighScore = data.high_score;
                updateUIForLogin();
            }
        }
    },

    //signin
    async handleSignUp() {
        const u = document.getElementById('su-user').value;
        const p = document.getElementById('su-pass').value;
        if (!u || !p) return alert("FIELDS REQUIRED");

        //check if username is used
        const { data: existing } = await _supabase.from('leaderboards').select('username').eq('username', u).maybeSingle();
        if (existing) return alert("PILOT IDENTITY ALREADY TAKEN");

        //update database
        const { error } = await _supabase.from('leaderboards').insert([{
            username: u,
            password: p,
            high_score: 0
        }]);
        if (error) return alert("ENLISTMENT FAILED: " + error.message);
        
        //autologin in signup
        currentUser = u;
        userHighScore = 0;
        localStorage.setItem('vortex_user', u);
        updateUIForLogin();
        closeModals();
    },

    //login
    async handleLogin() {
        const u = document.getElementById('li-user').value;
        const p = document.getElementById('li-pass').value;
        const { data } = await _supabase.from('leaderboards').select('*').eq('username', u).eq('password', p).maybeSingle();
        
        if(data) {
            currentUser = u;
            userHighScore = data.high_score;
            localStorage.setItem('vortex_user', u);
            updateUIForLogin();
            closeModals();
        } else {
            alert("ACCESS DENIED");
        }
    }
};

//leaderboard
async function openLeaderboard() {
    openModal('leaderboard-modal');
    const lbList = document.getElementById('lb-list');
    lbList.innerHTML = "FETCHING DATA...";

    const { data, error } = await _supabase
        .from('leaderboards')
        .select('username, high_score')
        .order('high_score', { ascending: false })
        .limit(5);

    if (error) {
        lbList.innerHTML = "SYSTEM ERROR: UNABLE TO REACH DATABASE";
    } else if (data) {
        lbList.innerHTML = data.map((e, i) =>
            //display top 5
            `<div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(0,255,0,0.2); padding:5px;">
                <span>${i+1}. ${e.username}</span>
                <span>${e.high_score}</span>
            </div>`
        ).join('');
    }
}

//logout
function logout() {
    localStorage.removeItem('vortex_user');
    location.reload();
}

window.onload = () => AuthManager.init();